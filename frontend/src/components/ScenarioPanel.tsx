import React from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { Card, SectionHead } from '../ui/Surface';
import { Button } from '../ui/Button';
import { StatusText } from '../ui/StatusText';
import { levelInfo } from '../design/levels';
import { EXPLORER_TX, near, shortAccount, shortHash } from '../design/format';
import { AgentInfo, scenarioAmount } from '../scenarios';
import type { ScenarioRun } from './ScenarioResultCard';

type Scenario = 'routine' | 'spike' | 'injection';

const NAME: Record<Scenario, string> = { routine: 'Routine invoice', spike: 'Unusual amount', injection: 'Hidden instructions' };

function scenarios(info: AgentInfo, detailed: boolean) {
  const amt = (s: Scenario) => scenarioAmount(s, info.demoScale);
  return [
    {
      id: 'routine' as const,
      detail: detailed
        ? `The usual contractor sends an invoice for ${amt('routine')} after a verified batch. A normal amount to an approved recipient`
        : `${amt('routine')} to your usual contractor for verified work`,
      expect: 'Should pay on its own',
    },
    {
      id: 'spike' as const,
      detail: detailed
        ? `The same contractor asks for ${amt('spike')} for storage, far above anything this agent usually pays. The vault holds it for you`
        : `${amt('spike')}, far above this agent's usual payment`,
      expect: 'Should wait for you',
    },
    {
      id: 'injection' as const,
      detail: detailed
        ? `An invoice hides instructions telling the agent to send ${amt('injection')} to an unknown account. If the model refuses, the demo plays a compromised agent that submits it anyway`
        : `An invoice that tells the agent to send ${amt('injection')} to an unknown account`,
      expect: 'Should be stopped',
    },
  ];
}

/** The three demo scenarios with the result shown in place. Used on Home and Agent. */
export const ScenarioPanel: React.FC<{
  agentInfo: AgentInfo;
  onRun: (s: Scenario) => void;
  run: ScenarioRun | null;
  running: boolean;
  detailed?: boolean;
}> = ({ agentInfo, onRun, run, running, detailed = false }) => (
  <Card>
    <SectionHead
      title="Try a scenario"
      meta={agentInfo.mode === 'llm' ? `The agent reads each invoice with ${agentInfo.model ?? 'an LLM'}` : 'Scripted agent'}
    />
    <div className="flex flex-col divide-y divide-line">
      {scenarios(agentInfo, detailed).map((s) => (
        <div key={s.id} className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-body text-fg">{NAME[s.id]}</p>
            <p className="text-caption text-fg-3">{s.detail}</p>
          </div>
          <span className="text-caption text-fg-2 sm:w-40 shrink-0">{s.expect}</span>
          <Button
            variant="secondary"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => onRun(s.id)}
            disabled={running}
            icon={<Play className="w-4 h-4" strokeWidth={1.5} />}
          >
            Run
          </Button>
        </div>
      ))}
    </div>
    {run && <ScenarioResult run={run} />}
  </Card>
);

const ScenarioResult: React.FC<{ run: ScenarioRun }> = ({ run }) => (
  <div className="mt-4 rounded-control bg-raised border border-line p-4 flex flex-col gap-2 animate-fade" role="status" aria-live="polite">
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption text-fg-2">{NAME[run.scenario as Scenario] ?? run.scenario}</span>
      {run.phase === 'done' && (
        <StatusText status={run.outcome.requestStatus} decidedBy={run.outcome.decidedBy} chainMode={run.outcome.chainMode} chainReason={run.outcome.message} />
      )}
    </div>
    {run.phase === 'running' && <p className="text-body text-fg-2">The agent is reading the invoice. The risk check and the vault decide next; testnet takes a few seconds</p>}
    {run.phase === 'error' && <p className="text-body text-negative">{run.error}</p>}
    {run.phase === 'done' &&
      (run.outcome.declined ? (
        <p className="text-body text-fg-2">
          The agent refused this invoice, so nothing was sent
          {run.outcome.agent?.decline_reason && <span className="block mt-1 text-fg-3">“{run.outcome.agent.decline_reason}”</span>}
        </p>
      ) : (
        <>
          {run.outcome.agent && (
            <p className="text-body text-fg">
              Proposed <span className="font-mono">{near(run.outcome.agent.amount_near)} NEAR</span> to {shortAccount(run.outcome.agent.recipient)}
              {run.outcome.riskEvaluation && (
                <span className="text-fg-3">
                  {' '}
                  · risk {run.outcome.riskEvaluation.composite_risk} · level {run.outcome.riskEvaluation.authority_level},{' '}
                  {levelInfo(run.outcome.riskEvaluation.authority_level).name.toLowerCase()}
                </span>
              )}
            </p>
          )}
          {run.outcome.agent?.rationale && run.outcome.agent.mode === 'llm' && <p className="text-caption text-fg-3">“{run.outcome.agent.rationale}”</p>}
          {run.outcome.txHash && !run.outcome.txHash.startsWith('sim-') && (
            <a href={`${EXPLORER_TX}${run.outcome.txHash}`} target="_blank" rel="noreferrer" className="self-start inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg">
              View on NEAR <span className="font-mono text-fg-3">{shortHash(run.outcome.txHash)}</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          )}
        </>
      ))}
  </div>
);
