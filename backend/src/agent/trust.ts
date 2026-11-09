/**
 * Trust changes driven by final on-chain outcomes (RISK_MODEL.md section 3):
 * +2 on a confirmed success (at most +10 per 24 h), -15 when the owner rejects,
 * -5 when a transfer fails on-chain. RPC errors and simulated results never count.
 */
import { repo, StoredRequest } from '../db/store';
import { RiskEngine, TrustOutcome, MODEL } from '../risk/engine';

const engine = new RiskEngine();
export const TRUST_EVENT = 'TrustUpdated';

/** Maps a request's final state to a trust outcome, or null if it should not move trust. */
export function trustOutcomeFor(req: StoredRequest): TrustOutcome | null {
  if (req.chain_mode !== 'testnet') return null;
  if (req.status === 'succeeded') return 'succeeded';
  if (req.status === 'rejected' && req.decided_by === 'owner') return 'owner_rejected';
  if (req.status === 'failed' && req.decided_by === 'vault') return 'failed_onchain';
  return null;
}

/** Applies the outcome once per request; returns the delta (0 if nothing changed). */
export async function applyTrustOutcome(req: StoredRequest): Promise<number> {
  const outcome = trustOutcomeFor(req);
  if (!outcome) return 0;

  const events = await repo.getAuditEvents(500);
  if (events.some((e) => e.event_type === TRUST_EVENT && e.target_id === req.request_id)) return 0;

  const agent = await repo.getAgent(req.agent_id);
  if (!agent) return 0;

  const now = Date.now();
  const gainedLast24h = events
    .filter((e) => e.event_type === TRUST_EVENT && e.timestamp >= now - MODEL.failureWindowMs)
    .reduce((sum, e) => sum + Math.max(0, Number(e.details?.delta ?? 0)), 0);

  const before = engine.calculateTrustScore(agent.trust_score, now - agent.last_heartbeat);
  const { trust, delta } = engine.trustAfterOutcome(before, outcome, gainedLast24h);
  agent.trust_score = trust;
  agent.last_heartbeat = now;
  await repo.saveAgent(agent);
  await repo.logAudit(TRUST_EVENT, 'risk-engine', req.request_id, {
    outcome,
    delta,
    trust_before: before,
    trust_after: trust,
    gained_last_24h: gainedLast24h,
    capped: outcome === 'succeeded' && delta < MODEL.trust.successGain,
  });
  return delta;
}
