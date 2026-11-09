/** Audit events as one plain sentence each (docs/DESIGN.md section 6, Activity). */
import type { AuditEvent, PaymentRequest } from '../api/client';
import type { Ink } from './levels';
import { levelInfo } from './levels';
import { near, shortAccount } from './format';
import { plainReason, reasonWords } from './status';

export type ActivityGroup = 'payments' | 'you' | 'system';

export type Proof =
  | { kind: 'tx'; hash: string }
  | { kind: 'simulated' }
  | { kind: 'unverified' }
  | { kind: 'read' }
  | { kind: 'none' };

export interface ActivityLine {
  sentence: string;
  detail?: string;
  group: ActivityGroup;
  ink: Ink;
  proof: Proof;
  /** Setup noise that only appears under System. */
  quiet?: boolean;
}

/** Events that claim an on-chain outcome; without a hash they can't be checked. */
const CLAIMS_CHAIN = /OnChain|Succeeded|Held|RefusedByVault|RejectedByOwner|Dispatched/;

function payee(d: Record<string, unknown>, req?: PaymentRequest): string {
  const amount = (d.amount as number | undefined) ?? req?.amount_near;
  const recipient = (d.recipient as string | undefined) ?? req?.recipient;
  if (amount === undefined || !recipient) return 'a payment';
  return `${near(amount)} NEAR to ${shortAccount(recipient)}`;
}

function why(d: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof d.authority_level === 'number') parts.push(`Level ${d.authority_level}, ${levelInfo(d.authority_level).name.toLowerCase()}`);
  if (typeof d.risk === 'number') parts.push(`risk ${d.risk}`);
  const reasons = Array.isArray(d.reasons) ? (d.reasons as string[]).filter((c) => c !== 'LOW_HISTORY_PRIOR') : [];
  const top = reasons[0] ? reasonWords(reasons[0]).toLowerCase() : undefined;
  const head = parts.join(' · ');
  return [head, top].filter(Boolean).join(' · ') || undefined;
}

export function describeEvent(e: AuditEvent, requestsById: Map<string, PaymentRequest>): ActivityLine {
  const d = (e.details ?? {}) as Record<string, unknown>;
  const req = e.target_id ? requestsById.get(e.target_id) : undefined;
  const sim = e.event_type.startsWith('Simulated') || d.chain_mode === 'simulation' || e.tx_hash?.startsWith('sim-');
  const type = e.event_type.replace(/^Simulated/, '');
  const proof: Proof = e.tx_hash?.startsWith('sim-') || (sim && !e.tx_hash)
    ? { kind: 'simulated' }
    : e.tx_hash
      ? { kind: 'tx', hash: e.tx_hash }
      : type === 'RequestReconciledFromChain'
        ? { kind: 'read' }
        : CLAIMS_CHAIN.test(type)
          ? { kind: 'unverified' }
          : { kind: 'none' };
  const what = payee(d, req);
  const agentSaid = typeof d.agent_rationale === 'string' && d.agent_mode === 'llm' ? `Agent: “${String(d.agent_rationale).replace(/\.$/, '')}”` : undefined;

  switch (type) {
    case 'PaymentSucceeded':
      return { sentence: `Paid ${what}`, detail: why(d) ?? agentSaid, group: 'payments', ink: 'positive', proof };
    case 'PaymentHeldForApproval':
      return { sentence: `Held ${what} for your approval`, detail: why(d), group: 'payments', ink: 'brass', proof };
    case 'PaymentDispatched':
      return { sentence: `Sent ${what}, waiting for the receipt`, detail: why(d), group: 'payments', ink: 'neutral', proof };
    case 'PaymentRejectedOnChain':
      return { sentence: `The vault stopped ${what}. Nothing left the vault`, detail: why(d), group: 'payments', ink: 'negative', proof };
    case 'PaymentRefusedByVault': {
      const r = plainReason(d.chain_reason as string | undefined);
      return { sentence: `The vault couldn't pay ${what}${r ? `, ${r}` : ''}`, detail: why(d), group: 'payments', ink: 'negative', proof };
    }
    case 'PaymentBlockedByRiskEngine':
      return { sentence: `The risk check stopped ${what}${sim ? ' (simulated)' : ''}`, detail: why(d), group: 'payments', ink: 'negative', proof };
    case 'PaymentFailedOnChain':
      return { sentence: `A transfer of ${what} failed; the money went back to the vault`, group: 'payments', ink: 'negative', proof };
    case 'PaymentRpcError':
      return { sentence: `NEAR couldn't be reached for ${what}; nothing is assumed`, group: 'system', ink: 'neutral', proof };
    case 'PaymentApprovedByOwner':
      return { sentence: `You approved ${what}${sim ? ' (simulated)' : ''}`, group: 'you', ink: 'positive', proof };
    case 'PaymentRejectedByOwner':
      return { sentence: `You declined ${what}${sim ? ' (simulated)' : ''}`, group: 'you', ink: 'negative', proof };
    case 'AgentFrozen':
      return { sentence: `You froze spending${sim ? ' (simulated)' : ''}`, group: 'you', ink: 'neutral', proof };
    case 'AgentUnfrozen':
      return { sentence: `You unfroze spending${sim ? ' (simulated)' : ''}`, group: 'you', ink: 'neutral', proof };
    case 'PolicyUpdated':
      return { sentence: `You changed the limits${sim ? ' (simulated)' : ''}`, group: 'you', ink: 'neutral', proof };
    case 'AgentDeclinedTask':
      return {
        sentence: 'The agent refused an invoice, so nothing was sent',
        detail: typeof d.decline_reason === 'string' ? `“${d.decline_reason}”` : undefined,
        group: 'payments',
        ink: 'neutral',
        proof,
      };
    case 'RequestReconciledFromChain': {
      const from = d.from as string;
      const to = d.to as string;
      if (from === 'pending_approval' && to === 'succeeded')
        return { sentence: `You approved ${what}, and the vault paid it`, group: 'you', ink: 'positive', proof };
      if (from === 'pending_approval' && to === 'rejected')
        return {
          sentence: `You declined ${what}`,
          detail: typeof d.failure_reason === 'string' ? `Reason: ${d.failure_reason}` : undefined,
          group: 'you',
          ink: 'negative',
          proof,
        };
      if (to === 'expired') return { sentence: `${what.charAt(0).toUpperCase()}${what.slice(1)} expired; the money was released`, group: 'system', ink: 'neutral', proof };
      if (from === 'executing' && to === 'succeeded') return { sentence: `Receipt confirmed: ${what} arrived`, group: 'system', ink: 'positive', proof };
      return { sentence: `Status of ${what} updated from the vault: ${String(from).replace(/_/g, ' ')} to ${String(to).replace(/_/g, ' ')}`, group: 'system', ink: 'neutral', proof };
    }
    case 'TrustUpdated': {
      const after = Number(d.trust_after);
      const delta = Number(d.delta);
      const cause = d.outcome === 'succeeded' ? 'a paid invoice' : d.outcome === 'owner_rejected' ? 'you declined a payment' : 'a failed transfer';
      if (delta === 0) return { sentence: `Trust stayed at ${after.toFixed(1)}; today's limit for gains is reached`, group: 'system', ink: 'neutral', proof: { kind: 'none' } };
      return {
        sentence: `Trust ${delta > 0 ? 'rose' : 'fell'} to ${after.toFixed(1)} after ${cause}`,
        detail: `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}`,
        group: 'system',
        ink: delta > 0 ? 'positive' : 'negative',
        proof: { kind: 'none' },
      };
    }
    case 'VaultInitialized':
      return { sentence: 'The vault was set up', group: 'system', ink: 'neutral', proof, quiet: true };
    case 'MigrationCheck':
      return { sentence: 'Database check', group: 'system', ink: 'neutral', proof: { kind: 'none' }, quiet: true };
    default:
      return {
        sentence: type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
        group: 'system',
        ink: 'neutral',
        proof,
      };
  }
}

/** "Today", "Yesterday", "Sunday 8 November" */
export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  if (d.toDateString() === new Date(now).toDateString()) return 'Today';
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
