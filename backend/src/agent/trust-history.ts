/**
 * Trust over time for the Agent screen. Built from data that already exists:
 * risk evaluations (trust after each evaluation, and attack penalties) and
 * TrustUpdated events (outcome-driven changes). Nothing here changes trust.
 */
import { repo, DEFAULT_AGENT_ID } from '../db/store';
import { RiskEngine } from '../risk/engine';
import { TRUST_EVENT } from './trust';

export interface TrustPoint {
  t: number;
  trust: number;
  /** Change at this point, when known. */
  delta?: number;
  /** Plain-language cause, e.g. "paid invoice", "injection attempt". */
  cause?: string;
  request_id?: string;
}

const engine = new RiskEngine();
const round1 = (n: number) => Math.round(n * 10) / 10;

const OUTCOME_CAUSE: Record<string, string> = {
  succeeded: 'paid invoice',
  owner_rejected: 'you declined a payment',
  failed_onchain: 'failed transfer',
};

export async function buildTrustHistory(days = 7, agentId = DEFAULT_AGENT_ID): Promise<{ points: TrustPoint[]; current: number }> {
  const now = Date.now();
  const since = now - days * 86_400_000;
  const [evaluations, events, agent] = await Promise.all([repo.listRiskEvaluations(since, 300), repo.getAuditEvents(500), repo.getAgent(agentId)]);

  const points: TrustPoint[] = [];

  for (const e of evaluations) {
    const before = typeof e.feature_snapshot?.trust_before === 'number' ? (e.feature_snapshot.trust_before as number) : undefined;
    const attack = e.reasons.includes('PROMPT_INJECTION_DETECTED')
      ? 'injection attempt'
      : e.reasons.includes('EXCEEDS_HARD_PER_TX_CAP')
        ? 'over the per-payment limit'
        : undefined;
    const delta = before !== undefined ? round1(e.new_trust_score - before) : undefined;
    points.push({
      t: e.evaluated_at,
      trust: round1(e.new_trust_score),
      ...(attack && (delta === undefined || delta < 0) ? { delta, cause: attack } : {}),
      request_id: e.request_id,
    });
  }

  for (const ev of events) {
    if (ev.event_type !== TRUST_EVENT || ev.timestamp < since) continue;
    const d = ev.details ?? {};
    const delta = Number(d.delta);
    points.push({
      t: ev.timestamp,
      trust: round1(Number(d.trust_after)),
      ...(Number.isFinite(delta) && delta !== 0 ? { delta, cause: OUTCOME_CAUSE[String(d.outcome)] ?? 'outcome' } : {}),
      request_id: ev.target_id,
    });
  }

  const current = agent ? engine.calculateTrustScore(agent.trust_score, now - agent.last_heartbeat) : 50;
  points.sort((a, b) => a.t - b.t);
  points.push({ t: now, trust: current });
  return { points, current };
}
