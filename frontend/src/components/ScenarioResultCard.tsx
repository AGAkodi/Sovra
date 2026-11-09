import React from 'react';
import { Loader2, X, ExternalLink, Bot } from 'lucide-react';
import type { ScenarioOutcome } from '../api/client';
import { StatusText } from '../ui/StatusText';

export type ScenarioRun =
  | { phase: 'running'; scenario: string }
  | { phase: 'done'; scenario: string; outcome: ScenarioOutcome }
  | { phase: 'error'; scenario: string; error: string };

const EXPLORER = 'https://testnet.nearblocks.io/txns/';

/** Result of the last demo scenario: what the agent proposed and what the vault did. */
export const ScenarioResultCard: React.FC<{ run: ScenarioRun | null; onClose: () => void }> = ({ run, onClose }) => {
  if (!run) return null;
  const title = `${run.scenario.charAt(0).toUpperCase()}${run.scenario.slice(1)} scenario`;
  const border =
    run.phase === 'error' ? 'border-blocked-red/40' : run.phase === 'running' ? 'border-telemetry-cyan/40' : 'border-border-subtle';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 sm:right-auto md:left-64 sm:w-[26rem] z-40 p-4 rounded-card bg-surface-raised border ${border} shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {run.phase === 'running' ? <Loader2 className="w-4 h-4 text-telemetry-cyan animate-spin" /> : <Bot className="w-4 h-4 text-telemetry-cyan" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">{title}</p>
            {run.phase === 'done' && (
              <StatusText status={run.outcome.requestStatus} chainMode={run.outcome.chainMode} decidedBy={run.outcome.decidedBy} chainReason={run.outcome.message} />
            )}
          </div>

          {run.phase === 'running' && (
            <p className="text-xs text-text-secondary">Agent is reading the invoice; the risk engine and vault decide next. Testnet calls take a few seconds.</p>
          )}

          {run.phase === 'error' && <p className="text-xs text-blocked-red break-words">{run.error}</p>}

          {run.phase === 'done' && (() => {
            const o = run.outcome;
            const a = o.agent;
            return (
              <div className="space-y-1.5 text-xs">
                {o.declined ? (
                  <p className="text-text-secondary">
                    The agent refused to propose this payment, so nothing was sent to the vault.
                    {a?.decline_reason && <span className="block mt-1 italic text-text-muted">“{a.decline_reason}”</span>}
                  </p>
                ) : (
                  <>
                    {a && (
                      <p className="text-text-secondary">
                        <span className="text-text-muted">Agent proposed </span>
                        <span className="font-mono text-text-primary">{a.amount_near} NEAR → {a.recipient}</span>
                        <span className="text-text-muted"> ({a.mode === 'llm' ? a.model ?? 'LLM' : 'scripted'})</span>
                      </p>
                    )}
                    {o.riskEvaluation && (
                      <p className="text-text-muted">
                        Risk {o.riskEvaluation.composite_risk} · Level {o.riskEvaluation.authority_level} ({o.riskEvaluation.authority_name})
                      </p>
                    )}
                    <p className="text-text-secondary break-words">{o.message}</p>
                    {a?.fallback_reason && <p className="text-caution-amber break-words">{a.fallback_reason}</p>}
                  </>
                )}
                {o.txHash && !o.txHash.startsWith('sim-') && (
                  <a
                    href={`${EXPLORER}${o.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-telemetry-cyan hover:underline"
                  >
                    {o.txHash.slice(0, 16)}…
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })()}
        </div>
        {run.phase !== 'running' && (
          <button onClick={onClose} aria-label="Dismiss" className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
