import React from 'react';
import { X, ExternalLink, ShieldCheck, Hash, Terminal, Cpu } from 'lucide-react';
import { PaymentRequest, RiskEvaluation } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { AuthorityPill } from './AuthorityPill';

interface EvidenceDrawerProps {
  request: PaymentRequest | null;
  evaluation?: RiskEvaluation;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ request, evaluation, onClose }) => {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-surface-raised border-l border-border-subtle h-full overflow-y-auto flex flex-col p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-text-muted">{request.request_id}</span>
              <StatusBadge status={request.status} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mt-1">Payment Evidence & Verification</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-secondary border border-border-subtle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Details */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-card bg-surface-secondary border border-border-subtle">
          <div>
            <span className="text-xs text-text-muted">Proposed Amount</span>
            <div className="text-xl font-semibold font-mono text-text-primary mt-0.5">
              {request.amount_near} <span className="text-xs font-normal text-text-muted">NEAR</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted">Target Payee</span>
            <div className="text-sm font-mono text-telemetry-cyan mt-1 truncate" title={request.recipient}>
              {request.recipient}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted">Composite Risk</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm font-semibold">{request.risk_score} / 100</span>
              <AuthorityPill level={request.authority_level} />
            </div>
          </div>
          <div>
            <span className="text-xs text-text-muted">Policy Version</span>
            <div className="text-sm font-mono text-text-secondary mt-1">
              On-chain v{request.vault_id || 1}
            </div>
          </div>
        </div>

        {/* Deterministic Risk Breakdown */}
        {evaluation && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-telemetry-cyan" />
              Deterministic Risk Factors
            </h3>
            <div className="space-y-2 p-3 rounded-card bg-surface-secondary/60 border border-border-subtle text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Amount vs Baseline (30%)</span>
                <span className="font-mono font-medium">{evaluation.components.amount_risk} / 100</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Velocity & Frequency (20%)</span>
                <span className="font-mono font-medium">{evaluation.components.velocity_risk} / 100</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Recipient Novelty (25%)</span>
                <span className="font-mono font-medium">{evaluation.components.recipient_risk} / 100</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Task Evidence Quality (15%)</span>
                <span className="font-mono font-medium">{evaluation.components.evidence_risk} / 100</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Historical Failure Rate (10%)</span>
                <span className="font-mono font-medium">{evaluation.components.failure_risk} / 100</span>
              </div>
              {evaluation.reasons.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-subtle">
                  <span className="text-text-muted">Triggered Reasons:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {evaluation.reasons.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#273446]/50 text-text-secondary font-mono text-[10px]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Completion Deliverables */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-telemetry-cyan" />
            Agent Task & Completion Deliverables
          </h3>
          <div className="p-3.5 rounded-card bg-[#0B1018] border border-border-subtle space-y-3 text-xs">
            <div>
              <span className="text-text-muted block mb-1">Instruction / Prompt:</span>
              <p className="text-text-primary font-mono bg-surface-secondary/40 p-2 rounded border border-border-subtle/50">
                {request.task_evidence.prompt}
              </p>
            </div>
            <div>
              <span className="text-text-muted block mb-1">Deliverable Summary:</span>
              <p className="text-text-secondary leading-relaxed">
                {request.task_evidence.completion_summary}
              </p>
            </div>
            <div>
              <span className="text-text-muted block mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Evidence Digest:
              </span>
              <span className="font-mono text-telemetry-cyan text-[11px] select-all break-all">
                {request.task_evidence.evidence_hash}
              </span>
            </div>
          </div>
        </div>

        {/* On-Chain Attestation & Receipt */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-confirmed-green" />
            NEAR Testnet Verification
          </h3>
          <div className="p-3.5 rounded-card bg-surface-secondary border border-border-subtle space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Agent Account:</span>
              <span className="font-mono text-text-secondary">{request.agent_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Expires At:</span>
              <span className="font-mono text-text-secondary">
                {new Date(Number(BigInt(request.expiry_ns) / 1000000n)).toISOString()}
              </span>
            </div>
            {request.tx_hash ? (
              <div className="pt-2 border-t border-border-subtle flex justify-between items-center">
                <span className="text-text-muted">Transaction Hash:</span>
                <a
                  href={`https://testnet.nearblocks.io/txns/${request.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-telemetry-cyan hover:underline flex items-center gap-1"
                >
                  {request.tx_hash.substring(0, 16)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="text-text-muted italic pt-1">No transaction hash broadcast yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

