/** Payment statuses in plain words (design.md section 2 glossary). */
import type { PaymentRequest } from '../api/client';
import type { Ink } from './levels';

export interface StatusWords {
  label: string;
  ink: Ink;
  /** One sentence for tooltips and the drawer. */
  detail: string;
}

/** Turns the vault's technical reason into a short phrase, e.g. "vault was frozen". */
export function plainReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (/frozen/i.test(reason)) return 'vault was frozen';
  if (/insufficient vault balance/i.test(reason)) return 'not enough funds';
  if (/per_tx_cap/i.test(reason)) return 'over the per-payment limit';
  if (/daily/i.test(reason)) return 'over the daily limit';
  if (/whitelist|allowed/i.test(reason)) return 'recipient not approved';
  return undefined;
}

export function statusWords(
  status: string,
  decidedBy?: PaymentRequest['decided_by'],
  chainMode?: 'testnet' | 'simulation',
  chainReason?: string
): StatusWords {
  const sim = chainMode === 'simulation';
  switch (status) {
    case 'succeeded':
      if (sim) return { label: 'Simulated', ink: 'neutral', detail: 'Simulation mode: nothing was sent to NEAR' };
      return decidedBy === 'owner'
        ? { label: 'Paid after your approval', ink: 'positive', detail: 'You approved it and the vault paid the recipient' }
        : { label: 'Paid', ink: 'positive', detail: 'The vault paid the recipient' };
    case 'pending_approval':
      return { label: 'Waiting for you', ink: 'brass', detail: 'The vault is holding the money until you approve or decline' };
    case 'executing':
      return { label: 'Sending', ink: 'neutral', detail: 'Sent to NEAR, waiting for the receipt' };
    case 'expired':
      return { label: 'Expired, funds released', ink: 'neutral', detail: 'Nobody decided within the hour, so the vault released the money' };
    case 'declined':
      return { label: 'Agent refused', ink: 'neutral', detail: 'The agent refused this invoice, so nothing was sent' };
    case 'rejected': {
      if (decidedBy === 'owner') return { label: 'You declined', ink: 'negative', detail: 'You declined it and the money stayed in the vault' };
      if (decidedBy === 'vault_refused') {
        const why = plainReason(chainReason);
        return { label: why ? `Couldn't pay, ${why}` : "Couldn't pay", ink: 'negative', detail: 'The vault refused the request; nothing was recorded or paid' };
      }
      if (decidedBy === 'vault') return { label: 'Stopped by the vault', ink: 'negative', detail: 'The vault contract rejected it on-chain; nothing left the vault' };
      return { label: 'Stopped by risk check', ink: 'negative', detail: 'The risk check stopped it before it reached NEAR' };
    }
    case 'failed':
      return decidedBy === 'rpc_error'
        ? { label: 'Network issue', ink: 'neutral', detail: "NEAR couldn't be reached; nothing is assumed about the outcome" }
        : { label: 'Transfer failed', ink: 'negative', detail: 'The vault tried to pay but the transfer failed; the money was returned to the vault' };
    default:
      return { label: status.replace(/_/g, ' '), ink: 'neutral', detail: '' };
  }
}

/** Plain-language reasons for the risk engine's codes. */
export const REASON_WORDS: Record<string, string> = {
  PROMPT_INJECTION_DETECTED: 'The task text tries to give the agent new instructions',
  INVALID_EVIDENCE_HASH: "The agent couldn't show proof of the finished work",
  EXCEEDS_HARD_PER_TX_CAP: 'More than the most you allow per payment',
  MASSIVE_AMOUNT_ANOMALY: "Far more than this agent's usual payment",
  HIGH_AMOUNT_VS_BASELINE: "Well above this agent's usual payment",
  MODERATE_AMOUNT_VARIATION: "A bit above this agent's usual payment",
  VELOCITY_SPIKE_1H: 'Many payments in the last hour',
  HIGH_FREQUENCY_ACTIVITY: 'More payments than usual this hour',
  NON_WHITELISTED_SEEN_RECIPIENT: "Paid before, but not on your approved list",
  UNKNOWN_NEW_RECIPIENT: 'A recipient this agent has never paid',
  ELEVATED_FAILURE_RATE: 'Several recent payments were stopped',
  LOW_HISTORY_PRIOR: 'The agent has little payment history yet',
  RECOVERING_FROM_INCIDENT: 'Rebuilding trust after a recent incident',
  VAULT_OR_AGENT_FROZEN: 'Spending is frozen',
  SPARSE_HISTORICAL_DATA: 'The agent has little payment history yet',
};

export function reasonWords(code: string): string {
  return REASON_WORDS[code] ?? code.toLowerCase().replace(/_/g, ' ');
}
