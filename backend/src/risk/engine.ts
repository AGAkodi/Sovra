/**
 * Deterministic risk engine. Implements docs/RISK_MODEL.md; where the code makes a
 * deliberate choice the spec leaves open, the doc's "Implementation notes" say so.
 */
export interface TaskEvidence {
  prompt: string;
  evidence_hash: string;
  completion_summary: string;
}

export interface PaymentProposal {
  agent_id: string;
  task_id: string;
  recipient: string;
  token: 'NEAR';
  amount_near: number;
  amount_yocto: string;
  timestamp: number;
  request_id: string;
  task_evidence: TaskEvidence;
  policy_version: number;
}

export type AuthorityLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const AuthorityLevelNames: Record<AuthorityLevel, string> = {
  1: 'Full Autonomous',
  2: 'Logged & Monitored',
  3: 'Velocity Restricted',
  4: 'Monitored Warning',
  5: 'Approval Required',
  6: 'Frozen / Blocked',
};

/** Bumped whenever scoring rules change; stored with every evaluation. */
export const ENGINE_VERSION = 'risk-v2';

export const MODEL = {
  /** Fewer successful payments than this adds the low-confidence prior. */
  lowHistoryThreshold: 5,
  lowHistoryPenalty: 20,
  /** The history baseline is only used once this many successful payments exist. */
  baselineMinSamples: 3,
  /** Median over at most this many most-recent successful payments. */
  baselineWindow: 20,
  failureWindowMs: 24 * 3600 * 1000,
  trust: {
    neutral: 50,
    halfLifeHours: 48,
    attackPenalty: 30,
    ownerRejectionPenalty: 15,
    chainFailurePenalty: 5,
    successGain: 2,
    maxGainPer24h: 10,
  },
  hysteresis: {
    windowMs: 24 * 3600 * 1000,
    cleanPaymentsToRecover: 3,
    /** Most autonomous level allowed while recovering from an incident. */
    recoveringFloor: 3 as AuthorityLevel,
  },
} as const;

export interface AgentHistory {
  successful_payments: { amount: number; timestamp: number; recipient: string }[];
  /** Agent-attributable failures. Excludes RPC errors and environmental vault refusals. */
  failed_payments: { amount: number; timestamp: number; recipient: string; reason: string }[];
  /** Timestamps of incidents (level-6 blocks, owner rejections). Drives hysteresis. */
  incidents?: number[];
  trust_score: number;
  last_activity_timestamp: number;
  is_frozen: boolean;
}

export type TrustOutcome = 'succeeded' | 'owner_rejected' | 'failed_onchain';

export interface RiskEvaluationResult {
  request_id: string;
  agent_id: string;
  recipient: string;
  amount_near: number;
  composite_risk: number;
  components: {
    amount_risk: number;
    velocity_risk: number;
    recipient_risk: number;
    evidence_risk: number;
    failure_risk: number;
  };
  reasons: string[];
  authority_level: AuthorityLevel;
  authority_name: string;
  requires_owner_approval: boolean;
  is_blocked: boolean;
  new_trust_score: number;
  feature_snapshot: Record<string, unknown>;
  evaluated_at: number;
}

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /disregard rules/i,
  /drain vault/i,
  /transfer all/i,
  /send everything/i,
  /emergency bypass/i,
  /override security/i,
  /attacker/i,
];

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export class RiskEngine {
  private whitelistedRecipients: Set<string>;
  private perTxCapNear: number;
  private dailyBudgetNear: number;
  /** Expected task payment until the agent has enough successful history. */
  private defaultBaselineNear: number;

  constructor(
    whitelistedRecipients: string[] = [],
    perTxCapNear: number = 10,
    dailyBudgetNear: number = 50,
    defaultBaselineNear: number = 3.0
  ) {
    this.whitelistedRecipients = new Set(whitelistedRecipients);
    this.perTxCapNear = perTxCapNear;
    this.dailyBudgetNear = dailyBudgetNear;
    this.defaultBaselineNear = defaultBaselineNear;
  }

  public setWhitelistedRecipients(recipients: string[]): void {
    this.whitelistedRecipients = new Set(recipients);
  }

  /** Mirror the vault's on-chain hard limits so off-chain scoring never disagrees with them. */
  public setLimits(perTxCapNear: number, dailyBudgetNear: number): void {
    this.perTxCapNear = perTxCapNear;
    this.dailyBudgetNear = dailyBudgetNear;
  }

  /**
   * Baseline payment size. Built only from successful payments (most recent window),
   * so rejected, blocked or attacker proposals cannot move it, and not used until
   * there are enough samples for the median to mean anything.
   */
  public baseline(successes: AgentHistory['successful_payments']): { median: number; samples: number; source: 'history' | 'default' } {
    const recent = [...successes].sort((a, b) => b.timestamp - a.timestamp).slice(0, MODEL.baselineWindow);
    if (recent.length < MODEL.baselineMinSamples) {
      return { median: this.defaultBaselineNear, samples: recent.length, source: 'default' };
    }
    return { median: median(recent.map((p) => p.amount).sort((a, b) => a - b)), samples: recent.length, source: 'history' };
  }

  public evaluateProposal(proposal: PaymentProposal, history: AgentHistory): RiskEvaluationResult {
    const now = proposal.timestamp || Date.now();
    const reasons: string[] = [];
    const decayedTrust = this.calculateTrustScore(history.trust_score, now - history.last_activity_timestamp);

    // 0. Owner freeze overrides everything.
    if (history.is_frozen) {
      reasons.push('VAULT_OR_AGENT_FROZEN');
      return {
        request_id: proposal.request_id,
        agent_id: proposal.agent_id,
        recipient: proposal.recipient,
        amount_near: proposal.amount_near,
        composite_risk: 100,
        components: { amount_risk: 100, velocity_risk: 100, recipient_risk: 100, evidence_risk: 100, failure_risk: 100 },
        reasons,
        authority_level: 6,
        authority_name: AuthorityLevelNames[6],
        requires_owner_approval: false,
        is_blocked: true,
        new_trust_score: decayedTrust,
        feature_snapshot: { frozen: true, engine_version: ENGINE_VERSION, policy_version: proposal.policy_version },
        evaluated_at: now,
      };
    }

    // 1. Evidence quality and prompt-injection scan.
    let evidence_risk = 0;
    const evidenceText = `${proposal.task_evidence.prompt} ${proposal.task_evidence.completion_summary}`;
    if (INJECTION_PATTERNS.some((p) => p.test(evidenceText))) {
      evidence_risk = 95;
      reasons.push('PROMPT_INJECTION_DETECTED');
    }
    if (!proposal.task_evidence.evidence_hash || proposal.task_evidence.evidence_hash.length < 16) {
      evidence_risk = Math.max(evidence_risk, 70);
      reasons.push('INVALID_EVIDENCE_HASH');
    }

    // 2. Amount anomaly vs the poisoning-resistant baseline.
    let amount_risk: number;
    const base = this.baseline(history.successful_payments);
    const ratio = proposal.amount_near / base.median;
    if (proposal.amount_near > this.perTxCapNear) {
      amount_risk = 100;
      reasons.push('EXCEEDS_HARD_PER_TX_CAP');
    } else if (ratio > 5) {
      amount_risk = 90;
      reasons.push('MASSIVE_AMOUNT_ANOMALY');
    } else if (ratio > 2.5) {
      amount_risk = 65;
      reasons.push('HIGH_AMOUNT_VS_BASELINE');
    } else if (ratio > 1.5) {
      amount_risk = 35;
      reasons.push('MODERATE_AMOUNT_VARIATION');
    } else {
      amount_risk = 5;
    }

    // 3. Velocity (trailing hour).
    let velocity_risk = 10;
    const txInLastHour = history.successful_payments.filter((p) => p.timestamp >= now - 3600 * 1000).length;
    if (txInLastHour > 10) {
      velocity_risk = 85;
      reasons.push('VELOCITY_SPIKE_1H');
    } else if (txInLastHour > 5) {
      velocity_risk = 50;
      reasons.push('HIGH_FREQUENCY_ACTIVITY');
    }

    // 4. Recipient novelty.
    let recipient_risk = 0;
    const isWhitelisted = this.whitelistedRecipients.has(proposal.recipient);
    const seenBefore = history.successful_payments.some((p) => p.recipient === proposal.recipient);
    if (!isWhitelisted && seenBefore) {
      recipient_risk = 35;
      reasons.push('NON_WHITELISTED_SEEN_RECIPIENT');
    } else if (!isWhitelisted) {
      recipient_risk = 85;
      reasons.push('UNKNOWN_NEW_RECIPIENT');
    }

    // 5. Failure rate over the trailing 24 hours.
    let failure_risk = 0;
    const since = now - MODEL.failureWindowMs;
    const recentOk = history.successful_payments.filter((p) => p.timestamp >= since).length;
    const recentFail = history.failed_payments.filter((p) => p.timestamp >= since).length;
    if (recentOk + recentFail > 0) {
      const failRatio = recentFail / (recentOk + recentFail);
      failure_risk = Math.round(failRatio * 100);
      if (failRatio > 0.3) reasons.push('ELEVATED_FAILURE_RATE');
    }

    let composite = Math.round(
      amount_risk * 0.3 + velocity_risk * 0.2 + recipient_risk * 0.25 + evidence_risk * 0.15 + failure_risk * 0.1
    );

    // Low confidence: a conservative prior until the agent has a track record.
    const lowHistory = history.successful_payments.length < MODEL.lowHistoryThreshold;
    if (lowHistory) {
      composite += MODEL.lowHistoryPenalty;
      reasons.push('LOW_HISTORY_PRIOR');
    }
    if (evidence_risk >= 90 || amount_risk >= 95) composite = Math.max(composite, 92);
    composite = Math.max(0, Math.min(100, composite));

    // Trust: decay toward neutral; attack attempts cost trust immediately. Gains only
    // come from confirmed on-chain success (trustAfterOutcome), never from evaluation.
    let newTrust = decayedTrust;
    const attack = reasons.includes('PROMPT_INJECTION_DETECTED') || reasons.includes('EXCEEDS_HARD_PER_TX_CAP');
    if (attack) newTrust = round1(Math.max(0, newTrust - MODEL.trust.attackPenalty));

    // Authority level (RISK_MODEL.md section 4), most restrictive first.
    let authority_level: AuthorityLevel;
    if (composite >= 90 || reasons.includes('PROMPT_INJECTION_DETECTED') || amount_risk === 100) {
      authority_level = 6;
    } else if (composite >= 70 || recipient_risk >= 80 || amount_risk >= 65) {
      authority_level = 5;
    } else if (composite < 15 && newTrust >= 80 && ratio <= 1) {
      authority_level = 1;
    } else if (composite < 35 && newTrust >= 65 && ratio <= 2) {
      authority_level = 2;
    } else if (composite < 55 && newTrust >= 50) {
      authority_level = 3;
    } else {
      // Risk 55-69, or trust too low for levels 1-3. Low trust alone never forces approval.
      authority_level = 4;
    }

    // Hysteresis: after an incident, autonomy comes back only through clean payments.
    const windowStart = now - MODEL.hysteresis.windowMs;
    const lastIncident = Math.max(0, ...(history.incidents ?? []).filter((t) => t >= windowStart && t <= now));
    const cleanSinceIncident = lastIncident
      ? history.successful_payments.filter((p) => p.timestamp > lastIncident).length
      : null;
    const recovering = cleanSinceIncident !== null && cleanSinceIncident < MODEL.hysteresis.cleanPaymentsToRecover;
    if (recovering && authority_level < MODEL.hysteresis.recoveringFloor) {
      authority_level = MODEL.hysteresis.recoveringFloor;
      reasons.push('RECOVERING_FROM_INCIDENT');
    }

    return {
      request_id: proposal.request_id,
      agent_id: proposal.agent_id,
      recipient: proposal.recipient,
      amount_near: proposal.amount_near,
      composite_risk: composite,
      components: { amount_risk, velocity_risk, recipient_risk, evidence_risk, failure_risk },
      reasons,
      authority_level,
      authority_name: AuthorityLevelNames[authority_level],
      requires_owner_approval: authority_level === 5,
      is_blocked: authority_level === 6,
      new_trust_score: newTrust,
      feature_snapshot: {
        engine_version: ENGINE_VERSION,
        policy_version: proposal.policy_version,
        baseline_median: base.median,
        baseline_sample_size: base.samples,
        baseline_source: base.source,
        amount_to_baseline_ratio: Math.round(ratio * 100) / 100,
        per_tx_cap_near: this.perTxCapNear,
        tx_in_last_hour: txInLastHour,
        is_whitelisted: isWhitelisted,
        seen_before: seenBefore,
        successes_24h: recentOk,
        failures_24h: recentFail,
        low_history_prior: lowHistory,
        trust_before: decayedTrust,
        recovering_from_incident: recovering,
        clean_payments_since_incident: cleanSinceIncident,
      },
      evaluated_at: now,
    };
  }

  public calculateTrustScore(currentTrust: number, elapsedMs: number): number {
    const elapsedHours = Math.max(0, elapsedMs) / (1000 * 3600);
    const lambda = Math.LN2 / MODEL.trust.halfLifeHours;
    return round1(MODEL.trust.neutral + (currentTrust - MODEL.trust.neutral) * Math.exp(-lambda * elapsedHours));
  }

  /**
   * Trust change for a final on-chain outcome. `gainedLast24h` is trust already earned
   * from successes in the trailing 24 h, which caps trust farming at +10 per day.
   */
  public trustAfterOutcome(trust: number, outcome: TrustOutcome, gainedLast24h: number): { trust: number; delta: number } {
    let delta = 0;
    if (outcome === 'succeeded') {
      delta = Math.max(0, Math.min(MODEL.trust.successGain, MODEL.trust.maxGainPer24h - gainedLast24h));
    } else if (outcome === 'owner_rejected') {
      delta = -MODEL.trust.ownerRejectionPenalty;
    } else {
      delta = -MODEL.trust.chainFailurePenalty;
    }
    const next = round1(Math.max(0, Math.min(100, trust + delta)));
    return { trust: next, delta: round1(next - trust) };
  }
}
