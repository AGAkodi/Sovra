import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, Agent, AuditEvent, PaymentRequest, TrustPoint, Vault } from '../api/client';
import { AgentInfo } from '../scenarios';
import { Card, SectionHead, Skeleton } from '../ui/Surface';
import { Notch } from '../ui/Notch';
import { TrustChart } from '../components/TrustChart';
import { ScenarioPanel } from '../components/ScenarioPanel';
import type { ScenarioRun } from '../components/ScenarioResultCard';
import { LEVELS, Level, levelInfo } from '../design/levels';
import { near, shortAccount } from '../design/format';

type Scenario = 'routine' | 'spike' | 'injection';

interface AgentMonitorScreenProps {
  agent: Agent | null;
  vault: Vault | null;
  requests: PaymentRequest[];
  events: AuditEvent[];
  agentInfo: AgentInfo;
  onRunScenario: (s: Scenario) => void;
  isScenarioRunning: boolean;
  scenarioRun: ScenarioRun | null;
}

const RULES: { change: string; when: string; ink: string }[] = [
  { change: '+2', when: 'A payment is confirmed on NEAR (at most +10 a day)', ink: 'text-positive' },
  { change: '−15', when: 'You decline a payment it asked for', ink: 'text-negative' },
  { change: '−5', when: 'A transfer fails on NEAR', ink: 'text-negative' },
  { change: '−30', when: 'It tries to pay over the limit or follows hidden instructions', ink: 'text-negative' },
  { change: '→ 50', when: 'Without activity it drifts back to neutral, halfway every 48 hours', ink: 'text-fg-2' },
];

function isToday(ms: number) {
  return new Date(ms).toDateString() === new Date().toDateString();
}

export const AgentMonitorScreen: React.FC<AgentMonitorScreenProps> = ({
  agent,
  vault,
  requests,
  events,
  agentInfo,
  onRunScenario,
  isScenarioRunning,
  scenarioRun,
}) => {
  const [history, setHistory] = useState<{ points: TrustPoint[]; current: number } | null>(null);
  const newest = events[0]?.id;
  useEffect(() => {
    let cancelled = false;
    api
      .getTrustHistory(7)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory({ points: [], current: agent?.trust_score ?? 50 }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest]);

  const level = levelInfo(agent?.authority_level);
  const trust = history?.current ?? agent?.trust_score;

  const facts = useMemo(() => {
    const paid = requests.filter((r) => r.status === 'succeeded');
    const amounts = paid.map((r) => r.amount_near).sort((a, b) => a - b);
    const mid = Math.floor(amounts.length / 2);
    const usual = amounts.length ? (amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2) : undefined;
    const today = paid.filter((r) => isToday(r.resolved_at ?? r.created_at));
    return {
      usual,
      paidToday: today.length,
      paidTodayNear: today.reduce((s, r) => s + r.amount_near, 0),
      recipients: vault?.allowed_recipients?.length ?? 0,
      paidCount: paid.length,
      total: requests.length,
    };
  }, [requests, vault]);

  const trustToday = useMemo(
    () => events.filter((e) => e.event_type === 'TrustUpdated' && isToday(e.timestamp)).reduce((s, e) => s + Number(e.details?.delta ?? 0), 0),
    [events]
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise">
        <h1 className="font-display text-page text-fg">Agent</h1>
        <p className="mt-1 text-caption text-fg-3">
          <span className="font-mono">{shortAccount(agent?.account_id) || 'agent'}</span>
          {agentInfo.mode === 'llm' ? ` · reads invoices with ${agentInfo.model ?? 'an LLM'}` : ' · scripted agent'}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-caption text-fg-2">
          <KeyRound className="w-4 h-4 text-fg-3" strokeWidth={1.5} />
          It can only ask the vault to pay. It holds no key that can move money itself
        </p>
      </header>

      {/* Trust over time: the moment of this screen */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 animate-rise [animation-delay:50ms]">
        <Card>
          <SectionHead title="Trust" meta="Last 7 days" />
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-display text-hero text-fg">{trust !== undefined ? trust.toFixed(1) : '—'}</span>
            <span className="text-caption text-fg-3">of 100</span>
            <span className={`ml-2 font-mono text-caption ${trustToday > 0 ? 'text-positive' : trustToday < 0 ? 'text-negative' : 'text-fg-3'}`}>
              {trustToday === 0 ? 'No change today' : `${trustToday > 0 ? '+' : '−'}${Math.abs(trustToday).toFixed(1)} today`}
            </span>
          </div>
          {history ? <TrustChart points={history.points} /> : <Skeleton className="h-[260px] w-full" />}
        </Card>

        <Card className="flex flex-col">
          <SectionHead title="How trust moves" />
          <ul className="flex flex-col divide-y divide-line">
            {RULES.map((r) => (
              <li key={r.change} className="py-3 first:pt-0 last:pb-0 grid grid-cols-[48px_1fr] gap-3 items-baseline">
                <span className={`font-mono text-body ${r.ink}`}>{r.change}</span>
                <span className="text-caption text-fg-2">{r.when}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-6 text-meta text-fg-3">Trust only rises after NEAR confirms a payment, so it can’t be farmed with requests</p>
        </Card>
      </section>

      {/* Levels */}
      <section className="animate-rise [animation-delay:100ms]">
        <Card padded={false}>
          <div className="px-6 pt-6">
            <SectionHead title="Levels" meta={`Its last payment was level ${level.level}, ${level.name.toLowerCase()}`} />
          </div>
          <ol className="divide-y divide-line border-t border-line">
            {([1, 2, 3, 4, 5, 6] as Level[]).map((l) => {
              const info = LEVELS[l];
              const current = l === level.level;
              return (
                <li
                  key={l}
                  className={`grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[56px_260px_minmax(0,1fr)] gap-x-4 gap-y-1 items-center px-6 py-3 ${current ? 'bg-raised/60' : ''}`}
                  aria-current={current ? 'step' : undefined}
                >
                  <Notch level={l} size="s" />
                  <span className={`text-body ${current ? 'text-fg' : 'text-fg-2'}`}>
                    Level {l} · {info.name}
                    {current && <span className="ml-2 text-meta text-brass">Last payment</span>}
                  </span>
                  <span className="col-start-2 sm:col-start-auto text-caption text-fg-3">{info.means}</span>
                </li>
              );
            })}
          </ol>
          <p className="px-6 py-4 border-t border-line text-meta text-fg-3">
            Each payment is placed on a level from its risk and the agent’s trust. After an incident the agent stays at level 3 or lower until it makes three clean payments
          </p>
        </Card>
      </section>

      {/* What normal looks like */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-rise [animation-delay:150ms]">
        <Fact label="Usual payment" figure={facts.usual !== undefined ? `${near(facts.usual)}` : '—'} unit="NEAR" context="Median of paid invoices" />
        <Fact label="Paid today" figure={`${facts.paidToday}`} unit={facts.paidToday === 1 ? 'payment' : 'payments'} context={`${near(facts.paidTodayNear)} NEAR in total`} />
        <Fact label="Approved recipients" figure={`${facts.recipients}`} unit={facts.recipients === 1 ? 'account' : 'accounts'} context="Others wait for you" />
        <Fact label="History" figure={`${facts.paidCount}`} unit="paid" context={`of ${facts.total} requests`} />
      </section>

      <section className="animate-rise [animation-delay:200ms]">
        <ScenarioPanel agentInfo={agentInfo} onRun={onRunScenario} run={scenarioRun} running={isScenarioRunning} detailed />
      </section>
    </div>
  );
};

const Fact: React.FC<{ label: string; figure: string; unit: string; context: string }> = ({ label, figure, unit, context }) => (
  <Card className="flex flex-col gap-2">
    <span className="text-caption text-fg-2">{label}</span>
    <span className="flex items-baseline gap-2">
      <span className="font-mono text-figure font-medium text-fg">{figure}</span>
      <span className="text-caption text-fg-3">{unit}</span>
    </span>
    <span className="text-meta text-fg-3">{context}</span>
  </Card>
);
