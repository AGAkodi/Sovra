import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api, PaymentRequest, RiskEvaluation, Vault } from '../api/client';
import { ApprovalSlip } from '../components/ApprovalSlip';
import { Banner, Card, SectionHead, Sheet } from '../ui/Surface';
import { Button } from '../ui/Button';
import { PaymentRow } from '../ui/PaymentRow';
import { near, shortAccount } from '../design/format';
import type { ScreenId } from '../components/Sidebar';

interface ApprovalCenterScreenProps {
  requests: PaymentRequest[];
  vault: Vault | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  /** When set, approve/decline are disabled and this explains why (e.g. wallet not connected). */
  ownerBlockedReason?: string;
  onOpenRequest: (r: PaymentRequest) => void;
  onNavigate: (s: ScreenId) => void;
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

type Pending = { kind: 'approve' | 'decline'; request: PaymentRequest } | null;

export const ApprovalCenterScreen: React.FC<ApprovalCenterScreenProps> = ({
  requests,
  vault,
  onApprove,
  onReject,
  ownerBlockedReason,
  onOpenRequest,
  onNavigate,
}) => {
  const now = useNow();
  const waiting = requests.filter((r) => r.status === 'pending_approval');
  const decided = useMemo(
    () =>
      requests
        .filter((r) => r.decided_by === 'owner' || r.status === 'expired')
        .sort((a, b) => (b.resolved_at ?? b.created_at) - (a.resolved_at ?? a.created_at))
        .slice(0, 5),
    [requests]
  );

  // The risk check's reasons live with the evaluation; fetch them for each waiting payment.
  const [evaluations, setEvaluations] = useState<Record<string, RiskEvaluation | undefined>>({});
  const waitingKey = waiting.map((r) => r.id).join(',');
  useEffect(() => {
    let cancelled = false;
    waiting.forEach((r) => {
      if (r.id in evaluations) return;
      api
        .getPaymentRequestDetails(r.id)
        .then((d) => !cancelled && setEvaluations((e) => ({ ...e, [r.id]: d.evaluation })))
        .catch(() => !cancelled && setEvaluations((e) => ({ ...e, [r.id]: undefined })));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingKey]);

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setPending(null);
    setReason('');
    setError(null);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'approve') await onApprove(pending.request.id);
      else await onReject(pending.request.id, reason.trim() || 'Declined by the owner in Sovra');
      setPending(null);
      setReason('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const available = vault ? vault.available_balance_near ?? Math.max(0, vault.vault_balance_near - vault.reserved_balance_near) : undefined;
  const p = pending?.request;

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise">
        <h1 className="font-display text-page text-fg">Approvals</h1>
        <p className="mt-1 text-caption text-fg-3">
          {waiting.length === 0 ? 'Nothing waiting' : waiting.length === 1 ? '1 payment is waiting for you' : `${waiting.length} payments are waiting for you`}
        </p>
      </header>

      {ownerBlockedReason && waiting.length > 0 && (
        <Banner kind="wallet">{ownerBlockedReason.includes('Connect') ? 'Connect your wallet to approve or decline' : ownerBlockedReason}</Banner>
      )}

      {waiting.length > 0 ? (
        <section className="flex flex-col gap-6" aria-label="Waiting for you">
          {waiting.map((r) => (
            <ApprovalSlip
              key={r.id}
              request={r}
              evaluation={evaluations[r.id]}
              now={now}
              availableNear={available}
              blockedReason={ownerBlockedReason}
              onApprove={() => setPending({ kind: 'approve', request: r })}
              onDecline={() => setPending({ kind: 'decline', request: r })}
            />
          ))}
        </section>
      ) : (
        <Card className="py-16 flex flex-col items-center text-center gap-2 animate-rise">
          <h2 className="font-display text-[28px] leading-8 text-fg">Nothing is waiting for you</h2>
          <p className="text-body text-fg-2 max-w-md">
            When a payment looks unusual, the vault holds the money here until you approve or decline it
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => onNavigate('payments')}>
            See payments
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </Card>
      )}

      {decided.length > 0 && (
        <section className="animate-rise [animation-delay:100ms]">
          <Card padded={false}>
            <div className="px-6 pt-6">
              <SectionHead title="Recent decisions" />
            </div>
            <div className="divide-y divide-line border-t border-line">
              {decided.map((r) => (
                <PaymentRow key={r.id} request={r} onOpen={onOpenRequest} />
              ))}
            </div>
          </Card>
        </section>
      )}

      <Sheet
        open={pending?.kind === 'approve'}
        title={p ? `Pay ${near(p.amount_near)} NEAR to ${shortAccount(p.recipient)}?` : ''}
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} busy={busy}>
              Approve and pay
            </Button>
          </>
        }
      >
        {p && (
          <div className="flex flex-col gap-3">
            <p>
              This releases only this payment, <span className="font-mono text-fg">{near(p.amount_near)} NEAR</span> to{' '}
              <span className="font-mono text-fg break-all">{p.recipient}</span>. It can’t be undone once it’s paid.
            </p>
            <p className="text-caption text-fg-3">Your wallet will ask you to sign</p>
            {error && <p className="text-caption text-negative break-words">{error}</p>}
          </div>
        )}
      </Sheet>

      <Sheet
        open={pending?.kind === 'decline'}
        title="Decline this payment?"
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger-fill" onClick={confirm} busy={busy}>
              Decline
            </Button>
          </>
        }
      >
        {p && (
          <div className="flex flex-col gap-3">
            <p>
              The {near(p.amount_near)} NEAR stays in the vault and becomes available again. Declining also lowers the agent’s trust by 15.
            </p>
            <label htmlFor="decline-reason" className="text-caption text-fg-2">
              Reason, kept in the activity log (optional)
            </label>
            <input
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Invoice doesn’t match the work"
              className="h-9 px-3 rounded-control bg-raised border border-line text-body text-fg placeholder:text-fg-3 focus:outline-none focus:border-brass/60"
            />
            <p className="text-caption text-fg-3">Your wallet will ask you to sign</p>
            {error && <p className="text-caption text-negative break-words">{error}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
};
