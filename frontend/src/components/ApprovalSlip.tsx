import React, { useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import type { PaymentRequest, RiskEvaluation } from '../api/client';
import { Button } from '../ui/Button';
import { Notch } from '../ui/Notch';
import { levelInfo } from '../design/levels';
import { reasonWords } from '../design/status';
import { near, shortAccount, taskLine, utc } from '../design/format';

/** The vault releases held funds after this long (contract APPROVAL_TTL_NS). */
export const APPROVAL_WINDOW_MS = 60 * 60 * 1000;

/** Brass ring counting down the approval window (docs/DESIGN.md moment 2). */
const CountdownRing: React.FC<{ remainingMs: number }> = ({ remainingMs }) => {
  const fraction = Math.max(0, Math.min(1, remainingMs / APPROVAL_WINDOW_MS));
  const minutes = Math.ceil(remainingMs / 60_000);
  const r = 44;
  const c = 2 * Math.PI * r;
  const expired = remainingMs <= 0;
  return (
    <div className="relative w-28 h-28" role="timer" aria-label={expired ? 'Expired' : `${minutes} minutes left to decide`}>
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgb(237 237 237 / 0.08)" strokeWidth="6" />
        {!expired && (
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            stroke="#c9a86a"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${c * fraction} ${c}`}
            style={{ transition: 'stroke-dasharray 1s linear' }}
          />
        )}
        {/* twelve engraved minute marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI;
          return (
            <line
              key={i}
              x1={56 + 34 * Math.cos(a)}
              y1={56 + 34 * Math.sin(a)}
              x2={56 + 37 * Math.cos(a)}
              y2={56 + 37 * Math.sin(a)}
              stroke="rgb(237 237 237 / 0.2)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-title font-medium text-fg">{expired ? '0' : minutes}</span>
        <span className="text-meta text-fg-3">{expired ? 'expired' : 'min left'}</span>
      </div>
    </div>
  );
};

/** What the agent said the payment is for: its own words when the LLM proposed it, else the task. */
function forLine(r: PaymentRequest): string {
  if (r.agent?.mode === 'llm' && r.agent.rationale && !r.agent.declined) return r.agent.rationale.replace(/\.$/, '');
  return taskLine(r.task_evidence?.prompt, 120);
}

export const ApprovalSlip: React.FC<{
  request: PaymentRequest;
  evaluation?: RiskEvaluation;
  now: number;
  availableNear?: number;
  blockedReason?: string;
  onApprove: () => void;
  onDecline: () => void;
}> = ({ request: r, evaluation, now, availableNear, blockedReason, onApprove, onDecline }) => {
  const [copied, setCopied] = useState(false);
  const expiresMs = Number(BigInt(r.expiry_ns) / 1_000_000n);
  const remaining = expiresMs - now;
  const expired = remaining <= 0;
  const level = levelInfo(r.authority_level);
  const reasons = (evaluation?.reasons ?? []).filter((c) => c !== 'LOW_HISTORY_PRIOR');
  const disabled = Boolean(blockedReason) || expired;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.recipient);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable; the address stays selectable.
    }
  };

  return (
    <article
      className="relative rounded-slip bg-[#1c1c1e] border border-line shadow-lift overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_256px] animate-rise"
      aria-label={`${near(r.amount_near)} NEAR to ${r.recipient}, waiting for your decision`}
    >
      {/* Engraved edge: a thin brass rule along the top, like the band on a cheque */}
      <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brass-deep via-brass to-brass-deep opacity-70" aria-hidden="true" />

      <div className="p-6 sm:p-8 flex flex-col gap-6 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-meta text-fg-3">Pay to</span>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span className="text-title text-fg truncate">{shortAccount(r.recipient)}</span>
              <button
                onClick={copy}
                className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised transition-colors duration-hover ease-vault"
                aria-label="Copy recipient account"
                title={r.recipient}
              >
                {copied ? <Check className="w-4 h-4 text-positive" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
            <span className="block font-mono text-meta text-fg-3 truncate">{r.recipient}</span>
          </div>
          <span className="text-meta text-fg-3 text-right shrink-0" title={utc(r.created_at)}>
            Requested
            <span className="block text-caption text-fg-2">{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
        </div>

        <div>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-hero text-fg">{near(r.amount_near)}</span>
            <span className="text-caption text-fg-3">NEAR</span>
          </span>
          <p className="mt-2 text-body text-fg-2 max-w-prose">For: {forLine(r)}</p>
        </div>

        <div className="border-t border-dashed border-line-strong pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Notch level={level.level} size="s" />
            <span className="text-caption text-fg">
              Waiting because the risk check marked it level {level.level}, {level.name.toLowerCase()}
            </span>
            <span className="ml-auto font-mono text-meta text-fg-3 whitespace-nowrap">Risk {r.risk_score}</span>
          </div>
          {reasons.length > 0 && (
            <ul className="flex flex-col gap-1.5 pl-[30px]">
              {reasons.map((code) => (
                <li key={code} className="text-caption text-fg-2 flex gap-2">
                  <span className="mt-[9px] w-1 h-1 rounded-full bg-fg-3 shrink-0" aria-hidden="true" />
                  {reasonWords(code)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="group">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg select-none">
            <ChevronDown className="w-4 h-4 transition-transform duration-menu ease-vault group-open:rotate-180" strokeWidth={1.5} />
            The task and invoice
          </summary>
          <div className="mt-3 flex flex-col gap-3 rounded-control bg-raised border border-line p-4">
            <p className="font-mono text-meta text-fg-2 whitespace-pre-wrap break-words">{r.task_evidence?.prompt}</p>
            {r.task_evidence?.completion_summary && <p className="text-caption text-fg-2">Delivered: {r.task_evidence.completion_summary}</p>}
            <p className="font-mono text-meta text-fg-3">
              {r.request_id} · limits version {r.policy_version ?? '—'}
            </p>
          </div>
        </details>
      </div>

      {/* Stub, separated by a perforation */}
      <div className="relative p-6 sm:p-8 flex flex-col gap-5 items-stretch border-t lg:border-t-0 lg:border-l border-dashed border-line-strong bg-card/60">
        <span className="hidden lg:block absolute -left-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-canvas border border-line" aria-hidden="true" />
        <span className="hidden lg:block absolute -left-[9px] -bottom-[9px] w-[18px] h-[18px] rounded-full bg-canvas border border-line" aria-hidden="true" />

        <div className="flex lg:flex-col items-center gap-4 lg:gap-3">
          <CountdownRing remainingMs={remaining} />
          <p className="text-caption text-fg-2 lg:text-center">
            {expired ? 'Time ran out. The vault releases the money on its next check' : 'If you don’t decide in time, the money stays in the vault'}
          </p>
        </div>

        {availableNear !== undefined && (
          <div className="flex items-baseline justify-between text-caption">
            <span className="text-fg-3">Available after this</span>
            <span className="font-mono text-fg-2">{near(availableNear)} NEAR</span>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-auto">
          <Button variant="primary" size="lg" onClick={onApprove} disabled={disabled} title={blockedReason}>
            Approve and pay
          </Button>
          <Button variant="secondary" size="lg" onClick={onDecline} disabled={disabled} title={blockedReason}>
            Decline
          </Button>
        </div>
      </div>
    </article>
  );
};
