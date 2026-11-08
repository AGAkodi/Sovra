import React from 'react';
import {
  Vault,
  Agent,
  PaymentRequest,
} from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { AuthorityPill } from '../components/AuthorityPill';
import {
  ShieldAlert,
  Coins,
  TrendingUp,
  Cpu,
  Play,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface OverviewScreenProps {
  vault: Vault | null;
  agent: Agent | null;
  requests: PaymentRequest[];
  onSelectRequest: (req: PaymentRequest) => void;
  onRunScenario: (scenario: 'routine' | 'spike' | 'injection') => void;
  isScenarioRunning: boolean;
  onNavigateToTab: (tab: 'agent' | 'payments' | 'approvals' | 'policies') => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  vault,
  agent,
  requests,
  onSelectRequest,
  onRunScenario,
  isScenarioRunning,
  onNavigateToTab,
}) => {
  const successfulCount = requests.filter((r) => r.status === 'succeeded').length;
  const blockedCount = requests.filter((r) => r.status === 'rejected').length;
  const pendingCount = requests.filter((r) => r.status === 'pending_approval').length;

  const currentRisk = requests.length > 0 ? requests[0].risk_score : 12;

  return (
    <div className="space-y-6">
      {/* Page Title & Environment */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Agent Security Overview</h1>
          <p className="text-xs text-text-muted mt-0.5">Adaptive authority for autonomous payments</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-[6px] bg-surface-raised border border-border-subtle text-xs font-mono text-text-secondary">
            Contract: <span className="text-telemetry-cyan">{vault?.contract_id || 'throttle-vault.testnet'}</span>
          </span>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Vault Balance</span>
            <Coins className="w-4 h-4 text-telemetry-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">
            {vault?.vault_balance_near?.toFixed(2) ?? '100.00'}{' '}
            <span className="text-xs font-normal text-text-muted">NEAR</span>
          </div>
          <div className="text-[11px] text-text-muted">
            Reserved: <span className="font-mono text-text-secondary">{vault?.reserved_balance_near?.toFixed(2) || '0.00'}</span> NEAR
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Current Trust</span>
            <TrendingUp className="w-4 h-4 text-confirmed-green" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">
            {agent?.trust_score?.toFixed(1) ?? '82.5'}{' '}
            <span className="text-xs font-normal text-text-muted">/ 100</span>
          </div>
          <div className="text-[11px] text-confirmed-green flex items-center gap-1">
            <span>Healthy (Half-life: 48h decay)</span>
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Current Authority</span>
            <Cpu className="w-4 h-4 text-telemetry-cyan" />
          </div>
          <div className="pt-1">
            <AuthorityPill level={agent?.authority_level ?? 1} />
          </div>
          <div className="text-[11px] text-text-muted pt-1">
            {agent?.authority_level === 1 ? 'Autonomous within baseline' : 'Heightened scrutiny'}
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Payments Today</span>
            <Layers className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">
            {successfulCount}{' '}
            <span className="text-xs font-normal text-blocked-red">/ {blockedCount} blk</span>
          </div>
          <div className="text-[11px] text-text-muted">
            Daily Budget: <span className="font-mono">{vault?.daily_spent_near?.toFixed(1) || '0.0'}</span> / {vault?.daily_budget_near || 50} N
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Risk Exposure</span>
            <ShieldAlert className="w-4 h-4 text-caution-amber" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">
            {currentRisk}{' '}
            <span className="text-xs font-normal text-text-muted">/ 100</span>
          </div>
          <div className="text-[11px] text-text-muted">
            Last evaluated score
          </div>
        </div>
      </div>

      {/* Main Grid: Left 2/3 Timeline & Right 1/3 Agent Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Authority Timeline */}
        <div className="lg:col-span-2 p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Authority & Risk Progression</h2>
              <p className="text-xs text-text-muted">Adaptive level transitions and risk bounds</p>
            </div>
            <button
              onClick={() => onNavigateToTab('agent')}
              className="text-xs text-telemetry-cyan hover:underline flex items-center gap-1 font-medium"
            >
              Monitor Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {requests.slice(0, 4).map((req, idx) => (
              <div
                key={req.id || idx}
                onClick={() => onSelectRequest(req)}
                className="p-3.5 rounded-card bg-surface-secondary/70 hover:bg-surface-secondary border border-border-subtle/80 cursor-pointer transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-telemetry-cyan" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-primary font-medium">{req.request_id}</span>
                      <AuthorityPill level={req.authority_level} />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1 max-w-md">
                      {req.task_evidence.prompt}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold text-text-primary">
                    {req.amount_near} NEAR
                  </div>
                  <div className="text-[11px] font-mono text-text-muted">
                    Risk: <span className="font-semibold text-text-secondary">{req.risk_score}</span>
                  </div>
                </div>
              </div>
            ))}

            {requests.length === 0 && (
              <div className="py-12 text-center text-text-muted text-xs space-y-2">
                <p>No agent payment activity recorded yet.</p>
                <p className="text-[11px]">Run a scenario on the right to witness Throttle evaluate real payments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3: Agent Status & Quick Scenarios */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Agent Runtime Status</h2>
            <span className="px-2 py-0.5 rounded-full bg-confirmed-greenDim/50 border border-confirmed-green/30 text-confirmed-green text-[10px] font-mono">
              ONLINE
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-border-subtle/50">
              <span className="text-text-muted">Agent ID</span>
              <span className="font-mono text-text-secondary">{agent?.account_id || 'throttle-agent.testnet'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border-subtle/50">
              <span className="text-text-muted">Key Scope</span>
              <span className="font-mono text-telemetry-cyan">request_payment only</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border-subtle/50">
              <span className="text-text-muted">Vault Contract</span>
              <span className="font-mono text-text-secondary">{vault?.contract_id || 'throttle-vault.testnet'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border-subtle/50">
              <span className="text-text-muted">Per-Tx Cap</span>
              <span className="font-mono text-text-secondary">{vault?.per_tx_cap_near || 10} NEAR</span>
            </div>
          </div>

          {/* Quick Demo Scenarios Trigger */}
          <div className="pt-2 border-t border-border-subtle space-y-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider block">
              Run Demo Scenario
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onRunScenario('routine')}
                disabled={isScenarioRunning || vault?.is_frozen}
                className="w-full flex items-center justify-between px-3 py-2 rounded-control bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-xs text-text-primary transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-confirmed-green" />
                  <span>1. Routine Payment (3 NEAR)</span>
                </div>
                <span className="text-[10px] text-text-muted font-mono">Autonomous</span>
              </button>

              <button
                onClick={() => onRunScenario('spike')}
                disabled={isScenarioRunning || vault?.is_frozen}
                className="w-full flex items-center justify-between px-3 py-2 rounded-control bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-xs text-text-primary transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-caution-amber" />
                  <span>2. Spending Anomaly (25 NEAR)</span>
                </div>
                <span className="text-[10px] text-caution-amber font-mono">Holds</span>
              </button>

              <button
                onClick={() => onRunScenario('injection')}
                disabled={isScenarioRunning || vault?.is_frozen}
                className="w-full flex items-center justify-between px-3 py-2 rounded-control bg-surface-secondary hover:bg-surface-secondary/80 border border-border-subtle text-xs text-text-primary transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-blocked-red" />
                  <span>3. Prompt Injection (80 NEAR)</span>
                </div>
                <span className="text-[10px] text-blocked-red font-mono">Blocked</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Recent Decisions Table */}
      <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Recent Payment Decisions</h2>
            <p className="text-xs text-text-muted">Click any row to open the complete evidence drawer</p>
          </div>
          <button
            onClick={() => onNavigateToTab('payments')}
            className="text-xs text-telemetry-cyan hover:underline flex items-center gap-1 font-medium"
          >
            View All ({requests.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Task Prompt</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Risk</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 font-mono">
              {requests.slice(0, 6).map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className="hover:bg-surface-secondary/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 text-text-muted text-[11px] whitespace-nowrap">
                    {new Date(req.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-3 font-medium text-text-primary">{req.request_id}</td>
                  <td className="py-3 px-3 font-sans text-text-secondary max-w-xs truncate">
                    {req.task_evidence.prompt}
                  </td>
                  <td className="py-3 px-3 text-telemetry-cyan truncate max-w-[140px]">{req.recipient}</td>
                  <td className="py-3 px-3 text-right font-semibold text-text-primary">
                    {req.amount_near} N
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`font-semibold ${
                        req.risk_score >= 70 ? 'text-blocked-red' : req.risk_score >= 40 ? 'text-caution-amber' : 'text-confirmed-green'
                      }`}
                    >
                      {req.risk_score}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <AuthorityPill level={req.authority_level} />
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <StatusBadge status={req.status} chainMode={req.chain_mode} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {requests.length === 0 && (
            <div className="py-8 text-center text-text-muted text-xs">
              No payments evaluated yet. Trigger a scenario above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

