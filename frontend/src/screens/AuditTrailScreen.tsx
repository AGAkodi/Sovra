import React, { useState } from 'react';
import { AuditEvent } from '../api/client';
import { Download, ExternalLink, History, ShieldAlert, Link2Off, Bot } from 'lucide-react';

interface AuditTrailScreenProps {
  events: AuditEvent[];
}

type FilterId = 'all' | 'paid' | 'held' | 'stopped' | 'system';

const STOPPED = /Rejected|Refused|Blocked|Declined|Failed|RpcError/;
const SYSTEM = /Reconciled|Freeze|Frozen|Policy|Migration|Initialized|Withdraw|Deposit/;

function groupOf(type: string): Exclude<FilterId, 'all'> {
  if (/Succeeded|Executed/.test(type)) return 'paid';
  if (/Held/.test(type)) return 'held';
  if (STOPPED.test(type)) return 'stopped';
  return 'system';
}

/** Events that claim something happened on-chain; without a tx hash they cannot be checked. */
const CLAIMS_CHAIN = /OnChain|Succeeded|Held|RefusedByVault|RejectedByOwner/;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All events' },
  { id: 'paid', label: 'Paid' },
  { id: 'held', label: 'Held for approval' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'system', label: 'Owner & system' },
];

/** "PaymentRejectedOnChain" -> "Payment rejected on chain" */
function humanize(type: string): string {
  const words = type.replace(/OnChain/g, 'Onchain').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function summary(e: AuditEvent): string {
  const d = e.details ?? {};
  const parts: string[] = [];
  if (d.amount !== undefined) parts.push(`${d.amount} NEAR to ${d.recipient ?? 'payee'}`);
  if (d.risk !== undefined) parts.push(`risk ${d.risk}`);
  if (d.from && d.to) parts.push(`${d.from} → ${d.to}`);
  if (Array.isArray(d.reasons) && d.reasons.length) parts.push((d.reasons as string[]).join(', '));
  else if (d.reason) parts.push(String(d.reason));
  if (d.failure_reason) parts.push(String(d.failure_reason));
  return parts.join(' · ') || (Object.keys(d).length ? JSON.stringify(d) : '');
}

function Proof({ e }: { e: AuditEvent }) {
  if (e.tx_hash?.startsWith('sim-')) {
    return <span className="text-text-muted italic text-[10px]">Simulated, no tx</span>;
  }
  if (e.tx_hash) {
    return (
      <a
        href={`https://testnet.nearblocks.io/txns/${e.tx_hash}`}
        target="_blank"
        rel="noreferrer"
        className="text-telemetry-cyan hover:underline flex items-center gap-1 font-mono text-[10px]"
      >
        Receipt {e.tx_hash.substring(0, 10)}…
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }
  if (CLAIMS_CHAIN.test(e.event_type)) {
    return (
      <span className="text-caution-amber text-[10px] flex items-center gap-1" title="This event claims an on-chain outcome but has no transaction hash to check it against.">
        <Link2Off className="w-3 h-3" />
        Unverified: no receipt
      </span>
    );
  }
  if (/Reconciled/.test(e.event_type)) {
    return <span className="text-text-muted italic text-[10px]">Read from vault contract</span>;
  }
  return <span className="text-text-muted italic text-[10px]">Off-chain record</span>;
}

export const AuditTrailScreen: React.FC<AuditTrailScreenProps> = ({ events }) => {
  const [filter, setFilter] = useState<FilterId>('all');

  // Setup probes are noise in the main feed; they stay visible under "Owner & system".
  const filtered = events.filter((e) =>
    filter === 'all' ? e.event_type !== 'MigrationCheck' : groupOf(e.event_type) === filter
  );

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `throttle-audit-trail-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Audit Trail</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Append-only log of every evaluation, vault decision and owner action, linked to its testnet receipt
          </p>
        </div>
        <button
          onClick={handleExportJSON}
          disabled={events.length === 0}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-control bg-surface-raised border border-border-subtle hover:bg-surface-secondary text-xs text-text-primary font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-telemetry-cyan" />
          <span>Export JSON</span>
        </button>
      </div>

      <div className="flex gap-2 border-b border-border-subtle pb-3 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-control text-xs font-medium transition-colors border whitespace-nowrap ${
              filter === f.id
                ? 'bg-surface-secondary border-telemetry-cyan text-telemetry-cyan'
                : 'bg-transparent border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const group = groupOf(item.event_type);
          const Icon = group === 'stopped' ? ShieldAlert : item.event_type.startsWith('Agent') ? Bot : History;
          const iconTone = group === 'stopped' ? 'text-blocked-red' : group === 'held' ? 'text-caution-amber' : group === 'paid' ? 'text-confirmed-green' : 'text-telemetry-cyan';
          const text = summary(item);
          return (
            <div
              key={item.id}
              className="p-4 rounded-card bg-surface-raised border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2 rounded bg-surface-secondary border border-border-subtle mt-0.5 shrink-0 ${iconTone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-text-primary" title={item.event_type}>{humanize(item.event_type)}</span>
                    <span className="text-text-muted text-[11px] font-mono break-all">by {item.actor}</span>
                  </div>
                  {text && <div className="text-text-secondary text-[11px] break-words">{text}</div>}
                  {item.target_id && (
                    <div className="text-[10px] text-text-muted font-mono break-all">
                      Request <span className="text-telemetry-cyan">{item.target_id}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-1 text-[11px] font-mono">
                <span className="text-text-muted">
                  {new Date(item.timestamp).toISOString().replace('T', ' ').substring(0, 19)} UTC
                </span>
                <Proof e={item} />
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-text-muted text-xs">
            {events.length === 0 ? 'No audit events yet. Run a scenario to generate some.' : 'No events in this category.'}
          </div>
        )}
      </div>
    </div>
  );
};
