/** Number, time and identifier formatting used by every screen. */

/** NEAR amounts: up to 2 decimals, trailing zeros trimmed (0.3, 2.5, 15). */
export function near(amount: number | undefined | null, digits = 2): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return '—';
  return Number(amount.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** "2 min ago", "3 h ago", then "Yesterday 14:02", then "8 Nov 14:02". */
export function relativeTime(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (h < 12) return `${h} h ago`;
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

/** Full UTC timestamp for tooltips. */
export function utc(ms: number | undefined): string {
  if (!ms) return '';
  return `${new Date(ms).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** "Monday, 9 November" */
export function longDate(now = Date.now()): string {
  return new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** sovra-worker-monarch.testnet → sovra-worker-monarch */
export function shortAccount(id: string | undefined): string {
  if (!id) return '—';
  return id.replace(/\.testnet$|\.near$/, '');
}

/** 2tk6WddCU8qo…ZjgNGm */
export function shortHash(hash: string | undefined, head = 6, tail = 4): string {
  if (!hash) return '';
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export const EXPLORER_TX = 'https://testnet.nearblocks.io/txns/';
export const EXPLORER_ACCOUNT = 'https://testnet.nearblocks.io/address/';

/** First line of a task prompt, without the invoice, trimmed for a row. */
export function taskLine(prompt: string | undefined, max = 72): string {
  const first = (prompt ?? '').split('\n')[0].replace(/\s+/g, ' ').trim();
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}
