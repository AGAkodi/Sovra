import React, { useEffect, useState } from 'react';
import { PaymentRequest, Vault } from '../api/client';
import { Check, X, AlertTriangle, Clock, ShieldAlert, Copy, ExternalLink } from 'lucide-react';
import { AuthorityPill } from '../components/AuthorityPill';

interface ApprovalCenterScreenProps {
  requests: PaymentRequest[];
  vault: Vault | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  /** When set, approve/reject are disabled and this explains why (e.g. wallet not connected). */
  ownerBlockedReason?: string;
}

/** Live countdown to the on-chain approval deadline. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, '0')} left`;
}

export const ApprovalCenterScreen: React.FC<ApprovalCenterScreenProps> = ({
  requests,
  vault,
  onApprove,
  onReject,
  ownerBlockedReason,
}) => {
  const now = useNow();
  const pendingRequests = requests.filter((r) => r.status === 'pending_approval');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmHighValueId, setConfirmHighValueId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);

  const handleApproveClick = async (req: PaymentRequest) => {
    // Every held request needs an explicit second confirmation bound to amount + recipient.
    if (confirmHighValueId !== req.id) {
      setConfirmHighValueId(req.id);
      return;
    }

    setProcessingId(req.id);
    try {
      await onApprove(req.id);
      setConfirmHighValueId(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalId) return;
    setProcessingId(rejectModalId);
    try {
      await onReject(rejectModalId, rejectReason || 'Operator rejected from Approval Center');
      setRejectModalId(null);
      setRejectReason('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Approval Center</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cryptographically enforced human authorization gate for anomalous agent payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-caution-amberDim/50 border border-caution-amber/30 text-caution-amber text-xs font-mono font-medium">
            Pending Decisions: {pendingRequests.length}
          </span>
        </div>
      </div>

      {ownerBlockedReason && pendingRequests.length > 0 && (
        <div className="p-3 rounded-card bg-caution-amberDim/30 border border-caution-amber/40 text-xs text-caution-amber flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{ownerBlockedReason}</span>
        </div>
      )}

      {/* Queue of Cards */}
      <div className="space-y-4">
        {pendingRequests.map((req) => {
          const isHighValue = /AMOUNT/.test(req.reason ?? '');
          const expiresMs = Number(BigInt(req.expiry_ns) / 1_000_000n);
          const isExpired = expiresMs <= now;
          const blocked = !!ownerBlockedReason || isExpired;
          const isProcessing = processingId === req.id;
          const isConfirming = confirmHighValueId === req.id;

          return (
            <div
              key={req.id}
              className="p-5 rounded-panel bg-surface-raised border border-caution-amber/30 shadow-lg space-y-4 relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-text-primary">{req.request_id}</span>
                  <AuthorityPill level={req.authority_level} />
                  <span className="flex items-center gap-1 text-xs text-caution-amber font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Held for Approval
                  </span>
                </div>
                <div className="flex flex-col items-start md:items-end gap-0.5 text-xs font-mono text-text-muted">
                  <span className={isExpired ? 'text-blocked-red' : expiresMs - now < 10 * 60_000 ? 'text-caution-amber' : 'text-text-secondary'} title={`Approval deadline ${new Date(expiresMs).toISOString()}`}>
                    {formatRemaining(expiresMs - now)}
                  </span>
                  <span>Vault Balance Available: <span className="text-text-primary">{vault?.vault_balance_near.toFixed(2)} NEAR</span></span>
                </div>
              </div>

              {/* Core Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-card bg-surface-secondary border border-border-subtle">
                  <span className="text-xs text-text-muted">Payment Amount</span>
                  <div className="text-2xl font-bold font-mono text-text-primary mt-0.5">
                    {req.amount_near}{' '}
                    <span className="text-xs font-normal text-text-muted">NEAR</span>
                  </div>
                  {isHighValue && (
                    <span className="text-[10px] text-caution-amber flex items-center gap-1 mt-1 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Anomalous High-Value Spike
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-card bg-surface-secondary border border-border-subtle md:col-span-2">
                  <span className="text-xs text-text-muted">Bound Recipient Address</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-sm text-telemetry-cyan font-semibold select-all">
                      {req.recipient}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(req.recipient)}
                      className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
                      title="Copy Address"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-text-muted block mt-1">
                    Policy Version Bound: On-chain v{req.policy_version ?? '?'}
                  </span>
                </div>
              </div>

              {/* Task Evidence */}
              <div className="p-3.5 rounded-card bg-[#0B1018] border border-border-subtle space-y-2 text-xs">
                <span className="text-text-muted font-medium block">Agent Task Justification:</span>
                <p className="text-text-primary font-mono text-[11px] bg-surface-secondary/40 p-2 rounded">
                  {req.task_evidence.prompt}
                </p>
                <div className="text-text-secondary text-[11px]">
                  {req.task_evidence.completion_summary}
                </div>
                {req.reason && (
                  <div className="text-caution-amber text-[11px] pt-1">
                    <span className="font-semibold">Throttle Reason:</span> {req.reason}
                  </div>
                )}
              </div>

              {/* Second Confirmation Warning if High-Value */}
              {isConfirming && (
                <div className="p-3 rounded-card bg-caution-amberDim/40 border border-caution-amber text-xs text-caution-amber space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> You are authorizing only this request
                  </div>
                  <p className="text-[11px]">
                    Your wallet will ask you to sign an irreversible on-chain transfer of{' '}
                    <span className="font-bold font-mono">{req.amount_near} NEAR</span> strictly to{' '}
                    <span className="font-mono">{req.recipient}</span>.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRejectModalId(req.id)}
                  disabled={isProcessing || blocked}
                  title={ownerBlockedReason ?? (isExpired ? 'Approval window has lapsed' : undefined)}
                  className="px-4 py-2 rounded-control bg-blocked-redDim/40 border border-blocked-red/40 text-blocked-red hover:bg-blocked-redDim text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Reject Proposal</span>
                </button>

                <button
                  onClick={() => handleApproveClick(req)}
                  disabled={isProcessing || blocked}
                  title={ownerBlockedReason ?? (isExpired ? 'Approval window has lapsed' : undefined)}
                  className="px-5 py-2 rounded-control bg-confirmed-green text-[#0B1018] hover:bg-confirmed-green/90 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isProcessing
                      ? 'Waiting for wallet…'
                      : isConfirming
                      ? 'Confirm & Sign Transfer'
                      : 'Approve & Release Funds'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {pendingRequests.length === 0 && (
          <div className="p-12 rounded-panel bg-surface-raised border border-border-subtle text-center space-y-2">
            <Check className="w-8 h-8 text-confirmed-green mx-auto mb-1" />
            <h3 className="text-sm font-semibold text-text-primary">No Pending Approvals</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              All agent proposals are within autonomous policy boundaries or have been reviewed. Trigger Scenario #2 to test human-in-the-loop authorization.
            </p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-surface-raised border border-border-subtle rounded-panel p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Reject Payment Request</h3>
            <p className="text-xs text-text-muted">
              Enter the reason for rejection. The reserved NEAR will be released back to the available vault pool, and the agent's trust score will be penalized.
            </p>
            <input
              type="text"
              placeholder="e.g. Unverified invoice deliverable"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B1018] border border-border-subtle rounded-control text-xs text-text-primary focus:outline-none focus:border-blocked-red"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="px-3 py-1.5 rounded-control text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                className="px-4 py-1.5 rounded-control bg-blocked-red text-white text-xs font-semibold hover:bg-blocked-red/90"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

