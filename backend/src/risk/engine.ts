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

export interface AgentHistory {
  successful_payments: { amount: number; timestamp: number; recipient: string }[];
  failed_payments: { amount: number; timestamp: number; recipient: string; reason: string }[];
  trust_score: number;
  last_activity_timestamp: number;
  is_frozen: boolean;
}

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

export class RiskEngine {
  private whitelistedRecipients: Set<string>;
  private perTxCapNear: number;
  private dailyBudgetNear: number;
  /** Expected task payment when the agent has no history yet. */
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

  public evaluateProposal(
    proposal: PaymentProposal,
    history: AgentHistory
  ): RiskEvaluationResult {
    const now = proposal.timestamp || Date.now();
    const reasons: string[] = [];

    // 0. Emergency / Hard Overrides
    if (history.is_frozen) {
      reasons.push('VAULT_OR_AGENT_FROZEN');
      return {
        request_id: proposal.request_id,
        agent_id: proposal.agent_id,
        recipient: proposal.recipient,
        amount_near: proposal.amount_near,
        composite_risk: 100,
        components: {
          amount_risk: 100,
          velocity_risk: 100,
          recipient_risk: 100,
          evidence_risk: 100,
          failure_risk: 100,
        },
        reasons,
        authority_level: 6,
        authority_name: AuthorityLevelNames[6],
        requires_owner_approval: false,
        is_blocked: true,
        new_trust_score: history.trust_score,
        feature_snapshot: { frozen: true },
        evaluated_at: now,
      };
    }

    // 1. Evidence and Prompt Injection Analysis
    let evidence_risk = 0;
    const injectionPatterns = [
      /ignore previous instructions/i,
      /disregard rules/i,
      /drain vault/i,
      /transfer all/i,
      /send everything/i,
      /emergency bypass/i,
      /override security/i,
      /attacker/i,
    ];

    const evidenceText = `${proposal.task_evidence.prompt} ${proposal.task_evidence.completion_summary}`;
    for (const pattern of injectionPatterns) {
      if (pattern.test(evidenceText)) {
        evidence_risk = 95;
        reasons.push('PROMPT_INJECTION_DETECTED');
        break;
      }
    }

    if (!proposal.task_evidence.evidence_hash || proposal.task_evidence.evidence_hash.length < 16) {
      evidence_risk = Math.max(evidence_risk, 70);
      reasons.push('INVALID_EVIDENCE_HASH');
    }

    // 2. Amount Anomaly Calculation vs Baseline
    let amount_risk = 0;
    const pastAmounts = history.successful_payments.map((p) => p.amount).sort((a, b) => a - b);
    const baselineMedian = pastAmounts.length > 0
      ? pastAmounts[Math.floor(pastAmounts.length / 2)]
      : this.defaultBaselineNear;
    if (proposal.amount_near > this.perTxCapNear) {
      amount_risk = 100;
      reasons.push('EXCEEDS_HARD_PER_TX_CAP');
    } else {
      const ratio = proposal.amount_near / baselineMedian;
      if (ratio > 5) {
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
    }

    // 3. Velocity Risk (tx within last 1h and 24h)
    let velocity_risk = 0;
    const oneHourAgo = now - 3600 * 1000;
    const txInLastHour = history.successful_payments.filter((p) => p.timestamp >= oneHourAgo).length;
    if (txInLastHour > 10) {
      velocity_risk = 85;
      reasons.push('VELOCITY_SPIKE_1H');
    } else if (txInLastHour > 5) {
      velocity_risk = 50;
      reasons.push('HIGH_FREQUENCY_ACTIVITY');
    } else {
      velocity_risk = 10;
    }

    // 4. Recipient Novelty Risk
    let recipient_risk = 0;
    const isWhitelisted = this.whitelistedRecipients.has(proposal.recipient);
    const seenBefore = history.successful_payments.some((p) => p.recipient === proposal.recipient);

    if (isWhitelisted) {
      recipient_risk = 0;
    } else if (seenBefore) {
      recipient_risk = 35;
      reasons.push('NON_WHITELISTED_SEEN_RECIPIENT');
    } else {
      recipient_risk = 85;
      reasons.push('UNKNOWN_NEW_RECIPIENT');
    }

    // 5. Failure Rate Risk
    let failure_risk = 0;
    const totalAttempts = history.successful_payments.length + history.failed_payments.length;
    if (totalAttempts > 0) {
      const failRatio = history.failed_payments.length / totalAttempts;
      failure_risk = Math.round(failRatio * 100);
      if (failRatio > 0.3) {
        reasons.push('ELEVATED_FAILURE_RATE');
      }
    }

    // Sparse data penalty
    if (history.successful_payments.length < 3) {
      reasons.push('SPARSE_HISTORICAL_DATA');
    }

    // Weighted composite calculation
    let composite = Math.round(
      amount_risk * 0.30 +
      velocity_risk * 0.20 +
      recipient_risk * 0.25 +
      evidence_risk * 0.15 +
      failure_risk * 0.10
    );

    if (evidence_risk >= 90 || amount_risk >= 95) {
      composite = Math.max(composite, 92);
    }

    composite = Math.max(0, Math.min(100, composite));

    // Trust decay and update
    let newTrust = this.calculateTrustScore(history.trust_score, now - history.last_activity_timestamp);
    if (reasons.includes('PROMPT_INJECTION_DETECTED')) {
      newTrust = Math.max(0, newTrust - 35);
    } else if (reasons.includes('EXCEEDS_HARD_PER_TX_CAP')) {
      newTrust = Math.max(0, newTrust - 20);
    } else if (composite < 25) {
      newTrust = Math.min(100, newTrust + 1);
    }

    // Authority level determination
    let authority_level: AuthorityLevel;
    let requires_owner_approval = false;
    let is_blocked = false;

    if (composite >= 90 || reasons.includes('PROMPT_INJECTION_DETECTED') || amount_risk === 100) {
      authority_level = 6;
      is_blocked = true;
    } else if (composite >= 70 || recipient_risk >= 80 || amount_risk >= 65) {
      authority_level = 5;
      requires_owner_approval = true;
    } else if (composite >= 55) {
      authority_level = 4;
    } else if (composite >= 35) {
      authority_level = 3;
    } else if (composite >= 15 || newTrust < 75) {
      authority_level = 2;
    } else {
      authority_level = 1;
    }

    return {
      request_id: proposal.request_id,
      agent_id: proposal.agent_id,
      recipient: proposal.recipient,
      amount_near: proposal.amount_near,
      composite_risk: composite,
      components: {
        amount_risk,
        velocity_risk,
        recipient_risk,
        evidence_risk,
        failure_risk,
      },
      reasons,
      authority_level,
      authority_name: AuthorityLevelNames[authority_level],
      requires_owner_approval,
      is_blocked,
      new_trust_score: newTrust,
      feature_snapshot: {
        baseline_median: baselineMedian,
        baseline_sample_size: pastAmounts.length,
        per_tx_cap_near: this.perTxCapNear,
        tx_in_last_hour: txInLastHour,
        is_whitelisted: isWhitelisted,
        seen_before: seenBefore,
        total_history: totalAttempts,
      },
      evaluated_at: now,
    };
  }

  public calculateTrustScore(currentTrust: number, elapsedMs: number): number {
    const elapsedHours = elapsedMs / (1000 * 3600);
    const halfLifeHours = 48;
    const lambda = Math.LN2 / halfLifeHours;
    // Decays asymptotically toward 50
    const decayed = 50 + (currentTrust - 50) * Math.exp(-lambda * elapsedHours);
    return Math.round(decayed * 10) / 10;
  }
}
