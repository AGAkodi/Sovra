import { AgentInfo, scenarioAmount, agentModeLabel } from '../scenarios';
import React from 'react';
import { Agent, Vault, PaymentRequest } from '../api/client';
import { AuthorityPill } from '../components/AuthorityPill';
import {
  TrendingUp,
  Sliders,
  ShieldCheck,
  AlertCircle,
  Play,
  ArrowRight,
  Activity,
  History,
} from 'lucide-react';

interface AgentMonitorScreenProps {
  agent: Agent | null;
  vault: Vault | null;
  requests: PaymentRequest[];
  onRunScenario: (scenario: 'routine' | 'spike' | 'injection') => void;
  isScenarioRunning: boolean;
  onSelectRequest: (req: PaymentRequest) => void;
  agentInfo: AgentInfo;
}

export const AgentMonitorScreen: React.FC<AgentMonitorScreenProps> = ({
  agent,
  vault,
  requests,
  onRunScenario,
  isScenarioRunning,
  onSelectRequest,
  agentInfo,
}) => {
  const trustScore = agent?.trust_score ?? 82.5;
  const currentAuthority = agent?.authority_level ?? 1;

  const authoritySteps = [
    { level: 1, name: 'Full Autonomous', desc: 'Risk < 15, Trust ≥ 80' },
    { level: 2, name: 'Logged & Monitored', desc: 'Risk 15–34, Trust ≥ 65' },
    { level: 3, name: 'Velocity Restricted', desc: 'Risk 35–54, Trust ≥ 50' },
    { level: 4, name: 'Monitored Warning', desc: 'Risk 55–69, Trust ≥ 35' },
    { level: 5, name: 'Approval Required', desc: 'Risk 70–89 or Outlier' },
    { level: 6, name: 'Frozen / Blocked', desc: 'Risk ≥ 90 or Injection' },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Agent Monitor & Dynamic Authority</h1>
          <p className="text-xs text-text-muted mt-0.5">Real-time behavioral telemetry, trust decay, and drift scoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-[6px] bg-surface-raised border border-border-subtle text-xs font-mono text-text-secondary">
            Scope: <span className="text-telemetry-cyan">Restricted Function-Call Key</span>
          </span>
        </div>
      </div>

      {/* Trust Meter & Six-Step Authority Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trust Score Radial Card */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Decaying Trust Score</span>
            <TrendingUp className="w-4 h-4 text-confirmed-green" />
          </div>

          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-4 border-surface-secondary border-t-telemetry-cyan border-r-confirmed-green">
              <div className="text-3xl font-bold font-mono text-text-primary">
                {trustScore.toFixed(1)}
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3">
              Neutral baseline: 50.0 · Half-life: 48h
            </p>
          </div>

          <div className="p-2.5 rounded-card bg-surface-secondary text-[11px] text-text-muted space-y-1">
            <div className="flex justify-between">
              <span>Time decay toward neutral:</span>
              <span className="font-mono text-text-secondary">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Violation Penalty:</span>
              <span className="font-mono text-blocked-red">-35 trust</span>
            </div>
          </div>
        </div>

        {/* Six-Level Segmented Authority Rail */}
        <div className="lg:col-span-2 p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Six-Step Authority Rail</h2>
              <p className="text-xs text-text-muted">Contract-enforced operational permissions</p>
            </div>
            <AuthorityPill level={currentAuthority} />
          </div>

          {/* Segmented Rail */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
            {authoritySteps.map((step) => {
              const isCurrent = step.level === currentAuthority;
              return (
                <div
                  key={step.level}
                  className={`p-3 rounded-card border text-xs flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'bg-surface-secondary border-telemetry-cyan text-text-primary ring-1 ring-telemetry-cyan'
                      : 'bg-surface-secondary/40 border-border-subtle/60 text-text-muted opacity-80'
                  }`}
                >
                  <div className="font-mono text-xs font-semibold mb-1">
                    L{step.level}
                  </div>
                  <div className="font-medium text-[11px] leading-tight text-text-primary mb-1">
                    {step.name}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {step.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-card bg-[#0B1018] border border-border-subtle text-xs text-text-secondary space-y-1">
            <span className="font-semibold text-text-primary block">Current Tier Enforcement:</span>
            <p className="text-[11px] text-text-muted">
              {currentAuthority <= 2
                ? 'Autonomous Native NEAR transfers dispatched via contract Promise. Daily budget ceiling strictly enforced.'
                : currentAuthority === 5
                ? 'All proposed payments placed in on-chain PendingApproval state requiring owner wallet cryptographic authorization.'
                : 'Emergency killswitch active. Contract refuses execution unconditionally.'}
            </p>
          </div>
        </div>
      </div>

      {/* Behavior Baseline & Risk Factor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Behavior Baseline */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-telemetry-cyan" />
              Agent Behavioral Baseline
            </h2>
            <span className="text-xs text-text-muted">Rolling 30-day</span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="text-text-muted">Median Task Amount</span>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">3.0 NEAR</div>
              <span className="text-[10px] text-text-muted">Expected benchmark</span>
            </div>
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="text-text-muted">24h Cumulative Volume</span>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">
                {vault?.daily_spent_near?.toFixed(1) || '0.0'} NEAR
              </div>
              <span className="text-[10px] text-text-muted">Cap: {vault?.daily_budget_near || 50} NEAR</span>
            </div>
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="text-text-muted">Active Payee Whitelist</span>
              <div className="text-sm font-mono text-telemetry-cyan mt-1 truncate">
                {vault?.allowed_recipients?.length || 2} accounts
              </div>
              <span className="text-[10px] text-text-muted">Strict whitelist mode</span>
            </div>
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="text-text-muted">Historical Sample Size</span>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">
                {requests.length} payments
              </div>
              <span className="text-[10px] text-confirmed-green">High confidence</span>
            </div>
          </div>
        </div>

        {/* Scenario Lab */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-telemetry-cyan" />
              Interactive Scenario Lab
            </h2>
            <span className={`text-xs ${agentInfo.mode === 'llm' ? 'text-telemetry-cyan' : 'text-text-muted'}`}>{agentModeLabel(agentInfo)}</span>
          </div>
          <p className="text-xs text-text-muted">
            Task inputs are scripted; {agentInfo.mode === 'llm' ? 'the LLM reads each task and invoice and proposes the payment' : 'the payment proposal uses pre-extracted values'}. Risk scoring and the vault decision are always live.{vault?.is_frozen ? ' The vault is frozen: requests will be refused on-chain.' : ''}
          </p>

          <div className="space-y-2.5">
            <button
              onClick={() => onRunScenario('routine')}
              disabled={isScenarioRunning}
              className="w-full p-3 rounded-card bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-left transition-all flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-confirmed-green" /> Routine Microtask Completion ({scenarioAmount('routine', agentInfo.demoScale)})
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  Compute verification · Whitelisted payee · Low risk (L1 Autonomous)
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#134731]/40 text-[#38C98B] font-mono text-[10px]">
                Run
              </span>
            </button>

            <button
              onClick={() => onRunScenario('spike')}
              disabled={isScenarioRunning}
              className="w-full p-3 rounded-card bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-left transition-all flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-caution-amber" /> Spending Anomaly & Storage Allocation ({scenarioAmount('spike', agentInfo.demoScale)})
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  Anomalous amount &gt; baseline · Triggers Level 5 Human Approval hold
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#543D16]/40 text-[#F2B544] font-mono text-[10px]">
                Run
              </span>
            </button>

            <button
              onClick={() => onRunScenario('injection')}
              disabled={isScenarioRunning}
              className="w-full p-3 rounded-card bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-left transition-all flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blocked-red" /> Adversarial Prompt Injection Attack ({scenarioAmount('injection', agentInfo.demoScale)})
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  Embedded system override · Attacker recipient · Level 6 Blocked
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#4D1D1D]/40 text-[#EF6464] font-mono text-[10px]">
                Run
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

