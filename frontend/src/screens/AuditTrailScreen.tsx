import React, { useState } from 'react';
import { AuditEvent } from '../api/client';
import { Download, ExternalLink, ShieldCheck, History, Filter } from 'lucide-react';

interface AuditTrailScreenProps {
  events: AuditEvent[];
}

export const AuditTrailScreen: React.FC<AuditTrailScreenProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filtered = events.filter((e) => {
    if (filterType === 'all') return true;
    return e.event_type.toLowerCase().includes(filterType.toLowerCase());
  });

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `throttle-audit-trail-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Title & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Audit Trail & Forensic Evidence</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cryptographically anchored chronological ledger of all agent evaluations, authorizations, and receipts
          </p>
        </div>
        <button
          onClick={handleExportJSON}
          className="px-3.5 py-1.5 rounded-control bg-surface-raised border border-border-subtle hover:bg-surface-secondary text-xs text-text-primary font-medium flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4 text-telemetry-cyan" />
          <span>Export JSON for Judges</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-3">
        {['all', 'PaymentExecutedOnChain', 'PaymentHeldForApproval', 'PaymentBlocked', 'PolicyUpdated'].map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-control text-xs font-medium transition-colors border ${
                filterType === type
                  ? 'bg-surface-secondary border-telemetry-cyan text-telemetry-cyan'
                  : 'bg-transparent border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {type === 'all'
                ? 'All Events'
                : type === 'PaymentExecutedOnChain'
                ? 'Executed'
                : type === 'PaymentHeldForApproval'
                ? 'Held Approvals'
                : type === 'PaymentBlocked'
                ? 'Blocked'
                : 'Policy Changes'}
            </button>
          )
        )}
      </div>

      {/* Chronological Event Feed */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-card bg-surface-raised border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-surface-secondary border border-border-subtle text-telemetry-cyan mt-0.5 shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary font-sans">{item.event_type}</span>
                  <span className="text-text-muted text-[11px]">by {item.actor}</span>
                </div>
                <div className="text-text-secondary text-[11px] font-sans">
                  {item.details?.reasons
                    ? `Reasons: ${(item.details.reasons as string[]).join(', ')}`
                    : item.details?.reason
                    ? `Reason: ${item.details.reason}`
                    : item.details?.amount
                    ? `Amount: ${item.details.amount} NEAR to ${item.details.recipient || 'payee'}`
                    : JSON.stringify(item.details)}
                </div>
                {item.target_id && (
                  <div className="text-[10px] text-text-muted">
                    Target Request: <span className="text-telemetry-cyan">{item.target_id}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-1 text-[11px]">
              <span className="text-text-muted">
                {new Date(item.timestamp).toISOString().replace('T', ' ').substring(0, 19)} UTC
              </span>
              {item.tx_hash ? (
                <a
                  href={`https://testnet.nearblocks.io/txns/${item.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-telemetry-cyan hover:underline flex items-center gap-1 font-mono text-[10px]"
                >
                  Proof: {item.tx_hash.substring(0, 12)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-text-muted italic text-[10px]">Internal attestation</span>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-text-muted text-xs">
            No audit events found for selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

