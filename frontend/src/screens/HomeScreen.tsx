import React, { useMemo, useState } from 'react';
import { ArrowRight, Plus, Play, ExternalLink } from 'lucide-react';
import type { Agent, AuditEvent, PaymentRequest, Vault } from '../api/client';
import { AllowanceDial } from '../components/AllowanceDial';
import { Banner, Card, SectionHead, Skeleton } from '../ui/Surface';
import { Button } from '../ui/Button';
import { Notch } from '../ui/Notch';
import { PaymentRow } from '../ui/PaymentRow';
import { StatusText } from '../ui/StatusText';
import { levelInfo } from '../design/levels';
import { EXPLORER_TX, longDate, near, relativeTime, shortAccount, shortHash } from '../design/format';
import { AgentInfo, scenarioAmount } from '../scenarios';
import type { ScenarioRun } from '../components/ScenarioResultCard';
import type { ScreenId } from '../components/Sidebar';

type Scenario = 'routine' | 'spike' | 'injection';

interface HomeScreenProps {
  vault: Vault | null;
  agent: Agent | null;
  requests: PaymentRequest[];
  events: AuditEvent[];
  agentInfo: AgentInfo;
  testnetMode: boolean;
  onOpenRequest: (r: PaymentRequest) => void;
  onNavigate: (s: ScreenId) => void;
  onRunScenario: (s: Scenario) => void;
  scenarioRun: ScenarioRun | null;
  isScenarioRunning: boolean;
  onFund?: (amountNear: number) => Promise<void>;
  fundBlockedReason?: string;
}

/** Spendable now: the contract's figure when present, otherwise balance minus held. */
function available(v: Vault): number {
  return v.available_balance_near ?? Math.max(0, v.vault_balance_near - v.reserved_balance_near);
}

function isToday(ms: number) {
  return new Date(ms).toDateString() === new Date().toDateString();
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  vault,
  agent,
  requests,
  events,
  agentInfo,
  testnetMode,
  onOpenRequest,
  onNavigate,
  onRunScenario,
  scenarioRun,
  isScenarioRunning,
  onFund,
  fundBlockedReason,
}) => {
  const waiting = requests.filter((r) => r.status === 'pending_approval');
  const latest = requests[0];
  const level = levelInfo(agent?.authority_level);
  const frozen = Boolean(vault?.is_frozen);

  const trustToday = useMemo(
    () =>
      events
        .filter((e) => e.event_type === 'TrustUpdated' && isToday(e.timestamp))
        .reduce((sum, e) => sum + Number(e.details?.delta ?? 0), 0),
    [events]
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 animate-rise">
        <div>
          <h1 className="font-display text-page text-fg">Home</h1>
          <p className="mt-1 text-caption text-fg-3">{longDate()}</p>
        </div>
      </header>

      {waiting.length > 0 && (
        <Banner kind="waiting" action={{ label: 'Review', onClick: () => onNavigate('approvals') }}>
          {waiting.length === 1
            ? `${near(waiting[0].amount_near)} NEAR to ${shortAccount(waiting[0].recipient)} is waiting for you`
            : `${waiting.length} payments are waiting for you`}
        </Banner>
      )}

      {/* Row 1: the allowance dial and the balance */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 animate-rise [animation-delay:50ms]">
        <Card className="flex flex-col">
          <SectionHead title="Today" meta={vault ? `Daily limit ${near(vault.daily_budget_near)} NEAR` : undefined} />
          {vault ? (
            <>
              <AllowanceDial spent={vault.daily_spent_near} limit={vault.daily_budget_near} perPayment={vault.per_tx_cap_near} frozen={frozen} />
              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
                <Fact label="Spent" value={`${near(vault.daily_spent_near)} NEAR`} />
                <Fact label="Per payment" value={`${near(vault.per_tx_cap_near)} NEAR`} mark />
                <Fact label="Ask me above" value={`Risk ${vault.max_risk_for_autonomous}`} />
              </dl>
            </>
          ) : (
            <Skeleton className="h-64 w-full max-w-[400px] mx-auto" />
          )}
        </Card>

        <Card className="flex flex-col">
          <span className="text-caption text-fg-2">Available</span>
          {vault ? (
            <>
              <span className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-hero text-fg">{near(available(vault))}</span>
                <span className="text-caption text-fg-3">NEAR</span>
              </span>
              <p className="mt-2 text-meta text-fg-3">What your agent can spend right now</p>
              <dl className="mt-6 flex flex-col gap-3 border-t border-line pt-4">
                <Line label="Waiting for you" value={`${near(vault.reserved_balance_near)} NEAR`} />
                {vault.storage_reserve_near !== undefined && (
                  <Line
                    label="Reserved by NEAR"
                    value={`${near(vault.storage_reserve_near)} NEAR`}
                    title="NEAR keeps this to pay for the vault contract's storage; it can't be spent"
                  />
                )}
                <Line label="In the vault" value={`${near(vault.vault_balance_near)} NEAR`} />
              </dl>
              {testnetMode && onFund && <AddFunds onFund={onFund} blockedReason={fundBlockedReason} />}
            </>
          ) : (
            <Skeleton className="mt-3 h-16 w-40" />
          )}
        </Card>
      </section>

      {/* Row 2: trust, level, last risk */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-rise [animation-delay:100ms]">
        <Card className="flex flex-col gap-2">
          <span className="text-caption text-fg-2">Trust</span>
          <span className="font-mono text-figure font-medium text-fg">{agent ? agent.trust_score.toFixed(1) : '—'}</span>
          <span className="text-meta text-fg-3">
            {trustToday === 0 ? 'No change today' : `${trustToday > 0 ? '+' : '−'}${Math.abs(trustToday).toFixed(1)} today`}
            {' · out of 100'}
          </span>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-caption text-fg-2">Level</span>
          <span className="flex items-center gap-3 h-8">
            <Notch level={level.level} frozen={frozen} />
            <span className="text-title text-fg">{frozen ? 'Frozen' : level.name}</span>
          </span>
          <span className="text-meta text-fg-3">{frozen ? 'No payments until you unfreeze' : level.means}</span>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-caption text-fg-2">Last risk</span>
          <span className="font-mono text-figure font-medium text-fg">{latest ? latest.risk_score : '—'}</span>
          <span className="text-meta text-fg-3 truncate">
            {latest ? `${near(latest.amount_near)} NEAR to ${shortAccount(latest.recipient)} · ${relativeTime(latest.created_at)}` : 'No payments yet'}
          </span>
        </Card>
      </section>

      {/* Recent payments */}
      <section className="animate-rise [animation-delay:150ms]">
        <Card padded={false}>
          <div className="px-6 pt-6">
            <SectionHead
              title="Recent payments"
              meta={requests.length ? `${requests.length} in total` : undefined}
              action={
                requests.length > 6 ? (
                  <Button variant="quiet" size="sm" onClick={() => onNavigate('payments')}>
                    See all
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                ) : undefined
              }
            />
          </div>
          {requests.length ? (
            <div className="divide-y divide-line border-t border-line">
              {requests.slice(0, 6).map((r) => (
                <PaymentRow key={r.id} request={r} onOpen={onOpenRequest} />
              ))}
            </div>
          ) : (
            <p className="px-6 pb-6 text-body text-fg-3">No payments yet. Try a scenario below to see how Sovra handles one</p>
          )}
        </Card>
      </section>

      {/* Try a scenario */}
      <section className="animate-rise [animation-delay:200ms]">
        <Card>
          <SectionHead
            title="Try a scenario"
            meta={agentInfo.mode === 'llm' ? `The agent reads each invoice with ${agentInfo.model ?? 'an LLM'}` : 'Scripted agent'}
          />
          <div className="flex flex-col divide-y divide-line">
            <ScenarioLine
              title="Routine invoice"
              detail={`${scenarioAmount('routine', agentInfo.demoScale)} to your usual contractor for verified work`}
              expect="Should pay on its own"
              onRun={() => onRunScenario('routine')}
              disabled={isScenarioRunning}
            />
            <ScenarioLine
              title="Unusual amount"
              detail={`${scenarioAmount('spike', agentInfo.demoScale)}, far above this agent's usual payment`}
              expect="Should wait for you"
              onRun={() => onRunScenario('spike')}
              disabled={isScenarioRunning}
            />
            <ScenarioLine
              title="Hidden instructions"
              detail={`An invoice that tells the agent to send ${scenarioAmount('injection', agentInfo.demoScale)} to an unknown account`}
              expect="Should be stopped"
              onRun={() => onRunScenario('injection')}
              disabled={isScenarioRunning}
            />
          </div>
          {scenarioRun && <ScenarioResult run={scenarioRun} />}
        </Card>
      </section>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string; mark?: boolean }> = ({ label, value, mark }) => (
  <div className="flex flex-col gap-1 min-w-0">
    <dt className="text-meta text-fg-3 flex items-center gap-1.5">
      {mark && <span className="w-[2px] h-3 rounded-full bg-fg/60" aria-hidden="true" />}
      {label}
    </dt>
    <dd className="font-mono text-body text-fg truncate">{value}</dd>
  </div>
);

const Line: React.FC<{ label: string; value: string; title?: string }> = ({ label, value, title }) => (
  <div className="flex items-baseline justify-between gap-4" title={title}>
    <dt className="text-caption text-fg-2">{label}</dt>
    <dd className="font-mono text-caption text-fg">{value}</dd>
  </div>
);

const AddFunds: React.FC<{ onFund: (n: number) => Promise<void>; blockedReason?: string }> = ({ onFund, blockedReason }) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= 100;

  if (!open) {
    return (
      <div className="pt-6 flex flex-col gap-2">
        <Button variant="secondary" size="sm" className="self-start" icon={<Plus className="w-4 h-4" strokeWidth={1.5} />} onClick={() => setOpen(true)} disabled={Boolean(blockedReason)} title={blockedReason}>
          Add funds
        </Button>
        {blockedReason && <p className="text-meta text-fg-3">{blockedReason}</p>}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await onFund(value);
      setOpen(false);
    } catch {
      // The wallet toast explains what went wrong.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="pt-6 flex flex-col gap-2 animate-fade">
      <label htmlFor="add-funds" className="text-caption text-fg-2">
        Add to the vault
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="add-funds"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full h-9 pl-3 pr-14 rounded-control bg-raised border border-line text-body text-fg font-mono focus:outline-none focus:border-brass/60"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-meta text-fg-3">NEAR</span>
        </div>
        <Button type="submit" variant="primary" busy={busy} disabled={!valid}>
          Deposit
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      <p className="text-meta text-fg-3">You’ll confirm this in your wallet</p>
    </form>
  );
};

const ScenarioLine: React.FC<{ title: string; detail: string; expect: string; onRun: () => void; disabled: boolean }> = ({
  title,
  detail,
  expect,
  onRun,
  disabled,
}) => (
  <div className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
    <div className="flex-1 min-w-0">
      <p className="text-body text-fg">{title}</p>
      <p className="text-caption text-fg-3">{detail}</p>
    </div>
    <span className="text-caption text-fg-2 sm:w-40">{expect}</span>
    <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={onRun} disabled={disabled} icon={<Play className="w-4 h-4" strokeWidth={1.5} />}>
      Run
    </Button>
  </div>
);

const SCENARIO_NAME: Record<string, string> = { routine: 'Routine invoice', spike: 'Unusual amount', injection: 'Hidden instructions' };

/** What just happened, in place, under the scenarios. */
const ScenarioResult: React.FC<{ run: ScenarioRun }> = ({ run }) => (
  <div className="mt-4 rounded-control bg-raised border border-line p-4 flex flex-col gap-2 animate-fade" role="status" aria-live="polite">
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption text-fg-2">{SCENARIO_NAME[run.scenario] ?? run.scenario}</span>
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
                  · risk {run.outcome.riskEvaluation.composite_risk} · level {run.outcome.riskEvaluation.authority_level}, {levelInfo(run.outcome.riskEvaluation.authority_level).name}
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
