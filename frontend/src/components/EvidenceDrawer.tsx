import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { PaymentRequest, RiskEvaluation } from '../api/client';
import { StatusText } from '../ui/StatusText';
import { Notch } from '../ui/Notch';
import { levelInfo } from '../design/levels';
import { reasonWords, statusWords } from '../design/status';
import { EXPLORER_TX, near, shortAccount, shortHash, utc } from '../design/format';

interface EvidenceDrawerProps {
  request: PaymentRequest | null;
  evaluation?: RiskEvaluation;
  onClose: () => void;
}

const FACTORS: { key: keyof RiskEvaluation['components']; label: string; weight: number }[] = [
  { key: 'amount_risk', label: 'Amount compared with usual', weight: 30 },
  { key: 'recipient_risk', label: 'Recipient', weight: 25 },
  { key: 'velocity_risk', label: 'How often it pays', weight: 20 },
  { key: 'evidence_risk', label: 'Proof of the work', weight: 15 },
  { key: 'failure_risk', label: 'Recent stopped payments', weight: 10 },
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-caption text-fg-3">{title}</h3>
    {children}
  </section>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-b-0">
    <dt className="text-caption text-fg-3 shrink-0">{label}</dt>
    <dd className="text-caption text-fg-2 text-right min-w-0 break-all">{children}</dd>
  </div>
);

/** Everything about one payment, in the order a person asks: what, why, who decided, proof. */
export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ request: r, evaluation, onClose }) => {
  useEffect(() => {
    if (!r) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [r, onClose]);

  if (!r) return null;

  const level = levelInfo(r.authority_level);
  const words = statusWords(r.status, r.decided_by, r.chain_mode, r.chain_reason);
  const reasons = evaluation?.reasons ?? [];
  const components = evaluation?.components;
  const topFactor = components ? FACTORS.reduce((a, b) => (components[b.key] * b.weight > components[a.key] * a.weight ? b : a)).key : null;
  const expiryMs = Number(BigInt(r.expiry_ns || '0') / 1_000_000n);
  const sim = r.chain_mode === 'simulation';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Payment ${r.request_id}`}>
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <aside className="relative w-full sm:w-[480px] h-full bg-card border-l border-line sm:rounded-l-panel shadow-lift overflow-y-auto animate-drawer-in">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur px-6 h-14 flex items-center justify-between border-b border-line">
          <span className="text-caption text-fg-3" title={utc(r.created_at)}>
            Payment · {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised transition-colors duration-hover ease-vault"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-8">
          {/* What */}
          <div className="flex flex-col gap-2">
            <StatusText status={r.status} decidedBy={r.decided_by} chainMode={r.chain_mode} chainReason={r.chain_reason} />
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[56px] leading-[56px] tracking-[-0.02em] text-fg">{near(r.amount_near)}</span>
              <span className="text-caption text-fg-3">NEAR</span>
            </span>
            <span className="text-body text-fg-2">
              to <span className="text-fg">{shortAccount(r.recipient)}</span>
            </span>
            <p className="text-caption text-fg-3">{words.detail}</p>
          </div>

          {/* Why */}
          <Section title="Why">
            <div className="flex items-center gap-3">
              <Notch level={level.level} />
              <span className="text-body text-fg">
                Level {level.level}, {level.name.toLowerCase()}
              </span>
              <span className="ml-auto font-mono text-caption text-fg-2">Risk {r.risk_score}</span>
            </div>
            {reasons.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {reasons.map((code) => (
                  <li key={code} className="text-body text-fg-2 flex gap-2.5">
                    <span className="mt-2 w-1 h-1 rounded-full bg-fg-3 shrink-0" aria-hidden="true" />
                    {reasonWords(code)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-fg-2">{evaluation ? 'Nothing unusual about this payment' : 'Loading the risk check'}</p>
            )}
            {r.chain_reason && r.decided_by !== 'risk_engine' && (
              <p className="text-caption text-fg-3">
                Vault: <span className="font-mono">{r.chain_reason}</span>
              </p>
            )}
          </Section>

          {/* Risk factors */}
          {components && (
            <Section title="Risk check">
              <ul className="flex flex-col gap-3">
                {FACTORS.map((f) => {
                  const v = components[f.key];
                  return (
                    <li key={f.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-baseline">
                      <span className="text-caption text-fg-2">
                        {f.label} <span className="text-fg-3">· {f.weight}%</span>
                      </span>
                      <span className="font-mono text-meta text-fg-2">{v}</span>
                      <span className="col-span-2 h-1 rounded-full bg-raised overflow-hidden" aria-hidden="true">
                        <span
                          className={`block h-full rounded-full ${f.key === topFactor && v > 0 ? 'bg-brass' : 'bg-fg-3/60'}`}
                          style={{ width: `${Math.max(v, v > 0 ? 2 : 0)}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-meta text-fg-3">Each factor is scored 0–100 and weighted into the overall risk</p>
            </Section>
          )}

          {/* What the agent said */}
          {r.agent && (
            <Section title="What the agent said">
              {r.agent.mode === 'llm' && r.agent.rationale && !r.agent.declined && (
                <blockquote className="text-title text-fg border-l-2 border-brass pl-4">“{r.agent.rationale}”</blockquote>
              )}
              {r.agent.declined && <p className="text-body text-fg-2">The agent refused this invoice{r.agent.decline_reason ? `: “${r.agent.decline_reason}”` : ''}</p>}
              <dl>
                <Row label="Proposed">
                  <span className="font-mono">{near(r.agent.amount_near)} NEAR</span> to {shortAccount(r.agent.recipient)}
                </Row>
                <Row label="Read by">
                  {r.agent.mode === 'llm' ? r.agent.model ?? 'LLM' : 'Scripted agent'}
                  {r.agent.latency_ms !== undefined && <span className="text-fg-3"> · {r.agent.latency_ms} ms</span>}
                </Row>
              </dl>
              {r.agent.fallback_reason && <p className="text-caption text-fg-3">{r.agent.fallback_reason}</p>}
              <p className="text-meta text-fg-3">The agent only proposes. The risk check and the vault decide</p>
            </Section>
          )}

          {/* The task */}
          <Section title="The task">
            <p className="font-mono text-meta text-fg-2 whitespace-pre-wrap break-words rounded-control bg-raised border border-line p-4">{r.task_evidence.prompt}</p>
            {r.task_evidence.completion_summary && <p className="text-body text-fg-2">Delivered: {r.task_evidence.completion_summary}</p>}
            <p className="font-mono text-meta text-fg-3 break-all" title="Digest of the delivered work">
              {r.task_evidence.evidence_hash}
            </p>
          </Section>

          {/* Proof */}
          <Section title="Proof">
            {sim ? (
              <p className="text-body text-fg-2">Simulation mode: nothing was sent to NEAR, so there is no transaction to check</p>
            ) : r.tx_hash ? (
              <a
                href={`${EXPLORER_TX}${r.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="h-11 px-4 rounded-control bg-raised border border-line inline-flex items-center justify-between gap-3 text-body text-fg hover:bg-raised-hover transition-colors duration-hover ease-vault"
              >
                View on NEAR
                <span className="inline-flex items-center gap-2 font-mono text-meta text-fg-3">
                  {shortHash(r.tx_hash, 8, 6)}
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                </span>
              </a>
            ) : (
              <p className="text-body text-fg-2">No transaction yet</p>
            )}
            <dl>
              <Row label="Request">
                <span className="font-mono">{r.request_id}</span>
              </Row>
              <Row label="Recipient">
                <span className="font-mono">{r.recipient}</span>
              </Row>
              <Row label="Agent">
                <span className="font-mono">{r.agent_id}</span>
              </Row>
              <Row label="Limits version">{r.policy_version ?? '—'}</Row>
              {r.status === 'pending_approval' && expiryMs > 0 && <Row label="Decide by">{utc(expiryMs)}</Row>}
              {r.resolved_at && <Row label="Settled">{utc(r.resolved_at)}</Row>}
            </dl>
          </Section>
        </div>
      </aside>
    </div>
  );
};
