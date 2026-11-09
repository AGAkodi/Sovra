import React from 'react';
import { Loader2, X, ExternalLink } from 'lucide-react';
import type { ScenarioOutcome } from '../api/client';
import { StatusText } from '../ui/StatusText';
import { EXPLORER_TX, near, shortAccount, shortHash } from '../design/format';

export type ScenarioRun =
  | { phase: 'running'; scenario: string }
  | { phase: 'done'; scenario: string; outcome: ScenarioOutcome }
  | { phase: 'error'; scenario: string; error: string };

const NAME: Record<string, string> = { routine: 'Routine invoice', spike: 'Unusual amount', injection: 'Hidden instructions' };

/**
 * Small floating result, shown only when you leave Home or Agent while a scenario
 * runs (those screens show the result in place).
 */
export const ScenarioResultCard: React.FC<{ run: ScenarioRun | null; onClose: () => void }> = ({ run, onClose }) => {
  if (!run) return null;
  const o = run.phase === 'done' ? run.outcome : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:right-auto md:left-[272px] sm:w-96 z-40 p-4 rounded-card bg-card border border-line shadow-lift animate-sheet-in"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption text-fg-2">{NAME[run.scenario] ?? run.scenario}</span>
            {run.phase === 'running' && <Loader2 className="w-4 h-4 text-fg-3 animate-spin" strokeWidth={1.5} />}
            {o && <StatusText status={o.requestStatus} decidedBy={o.decidedBy} chainMode={o.chainMode} chainReason={o.message} />}
          </div>
          {run.phase === 'running' && <p className="text-caption text-fg-3">The agent is reading the invoice</p>}
          {run.phase === 'error' && <p className="text-caption text-negative break-words">{run.error}</p>}
          {o &&
            (o.declined ? (
              <p className="text-caption text-fg-2">The agent refused this invoice, so nothing was sent</p>
            ) : (
              o.agent && (
                <p className="text-caption text-fg-2">
                  <span className="font-mono text-fg">{near(o.agent.amount_near)} NEAR</span> to {shortAccount(o.agent.recipient)}
                </p>
              )
            ))}
          {o?.txHash && !o.txHash.startsWith('sim-') && (
            <a href={`${EXPLORER_TX}${o.txHash}`} target="_blank" rel="noreferrer" className="self-start inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg">
              View on NEAR <span className="font-mono text-meta text-fg-3">{shortHash(o.txHash)}</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
        {run.phase !== 'running' && (
          <button onClick={onClose} aria-label="Dismiss" className="text-fg-3 hover:text-fg">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};
