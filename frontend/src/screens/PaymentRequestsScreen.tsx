import React, { useState } from 'react';
import { PaymentRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { AuthorityPill } from '../components/AuthorityPill';
import { Search, Filter, ExternalLink } from 'lucide-react';

interface PaymentRequestsScreenProps {
  requests: PaymentRequest[];
  onSelectRequest: (req: PaymentRequest) => void;
}

export const PaymentRequestsScreen: React.FC<PaymentRequestsScreenProps> = ({
  requests,
  onSelectRequest,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filterChips = [
    { id: 'all', label: 'All' },
    { id: 'pending_approval', label: 'Needs Approval' },
    { id: 'executing', label: 'Executing' },
    { id: 'succeeded', label: 'Succeeded' },
    { id: 'rejected', label: 'Blocked / Rejected' },
    { id: 'failed_expired', label: 'Failed / Expired' },
  ];

  const filtered = requests.filter((r) => {
    if (filterStatus === 'failed_expired') {
      if (r.status !== 'failed' && r.status !== 'expired') return false;
    } else if (filterStatus !== 'all' && r.status !== filterStatus) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        r.request_id.toLowerCase().includes(q) ||
        r.recipient.toLowerCase().includes(q) ||
        r.task_evidence.prompt.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Payment Requests</h1>
          <p className="text-xs text-text-muted mt-0.5">Auditable ledger of autonomous agent payment proposals</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-card bg-surface-raised border border-border-subtle">
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => {
            const isActive = filterStatus === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilterStatus(chip.id)}
                className={`px-3 py-1.5 rounded-control text-xs font-medium transition-colors border ${
                  isActive
                    ? 'bg-surface-secondary border-telemetry-cyan text-telemetry-cyan'
                    : 'bg-transparent border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-secondary/40'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-auto md:min-w-[240px]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request ID, payee, prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#0B1018] border border-border-subtle rounded-control text-xs text-text-primary focus:outline-none focus:border-telemetry-cyan placeholder:text-text-muted/60 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      {/* Phones: one card per request */}
      <div className="md:hidden space-y-2">
        {filtered.map((req) => (
          <button
            key={req.id}
            onClick={() => onSelectRequest(req)}
            className="w-full text-left p-3.5 rounded-card bg-surface-raised border border-border-subtle hover:bg-surface-secondary/60 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-text-primary">{req.amount_near} NEAR</div>
                <div className="font-mono text-[11px] text-telemetry-cyan truncate">→ {req.recipient}</div>
              </div>
              <StatusBadge status={req.status} chainMode={req.chain_mode} decidedBy={req.decided_by} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <AuthorityPill level={req.authority_level} />
              <span className="font-mono text-text-muted">risk {req.risk_score}</span>
              <span className="font-mono text-text-muted">{new Date(req.created_at).toISOString().substring(11, 19)} UTC</span>
            </div>
            <p className="text-[11px] text-text-muted line-clamp-2">{req.chain_reason || req.reason || req.task_evidence.prompt}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-text-muted text-xs">
            {requests.length === 0 ? 'No payment requests yet. Run a scenario from the Overview to create one.' : 'No requests match this filter.'}
          </div>
        )}
      </div>

      <div className="hidden md:block p-5 rounded-panel bg-surface-raised border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Time (UTC)</th>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Agent</th>
                <th className="py-2.5 px-3">Recipient Payee</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Risk</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3">Reason / Trigger</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 font-mono">
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className="hover:bg-surface-secondary/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 text-text-muted text-[11px] whitespace-nowrap">
                    {new Date(req.created_at).toISOString().substring(11, 19)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-text-primary">{req.request_id}</td>
                  <td className="py-3 px-3 text-text-muted truncate max-w-[120px]">{req.agent_id}</td>
                  <td className="py-3 px-3 text-telemetry-cyan truncate max-w-[140px]">{req.recipient}</td>
                  <td className="py-3 px-3 text-right font-semibold text-text-primary whitespace-nowrap">
                    {req.amount_near} NEAR
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`font-semibold ${
                        req.risk_score >= 70
                          ? 'text-blocked-red'
                          : req.risk_score >= 40
                          ? 'text-caution-amber'
                          : 'text-confirmed-green'
                      }`}
                    >
                      {req.risk_score}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <AuthorityPill level={req.authority_level} />
                  </td>
                  <td className="py-3 px-3 font-sans text-text-muted max-w-xs truncate text-[11px]">
                    {req.chain_reason || req.reason || req.task_evidence.prompt}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <StatusBadge status={req.status} chainMode={req.chain_mode} decidedBy={req.decided_by} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-text-muted text-xs">
              {requests.length === 0
              ? 'No payment requests yet. Run a scenario from the Overview to create one.'
              : 'No requests match this filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

