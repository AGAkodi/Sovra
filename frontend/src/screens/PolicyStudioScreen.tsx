import React, { useState, useEffect } from 'react';
import { Vault } from '../api/client';
import { Sliders, Shield, Save, RefreshCw, AlertCircle, Lock, Undo2 } from 'lucide-react';
import { AuthorityPill } from '../components/AuthorityPill';
import { scenarioAmount } from '../scenarios';

export interface PolicyDraft {
  perTxCapNear: number;
  dailyBudgetNear: number;
  requireWhitelist: boolean;
  maxRiskForAutonomous: number;
}

interface PolicyStudioScreenProps {
  vault: Vault | null;
  onUpdatePolicy: (policy: PolicyDraft) => Promise<void>;
  /** Testnet: the owner signs set_policy in their wallet. */
  testnetMode: boolean;
  ownerBlockedReason?: string;
  demoScale: number;
}

const inputClass =
  'w-full px-3 py-2 bg-[#0B1018] border border-border-subtle rounded-control text-xs font-mono text-text-primary focus:outline-none focus:border-telemetry-cyan';

function validate(d: PolicyDraft): string | null {
  if (!(d.perTxCapNear > 0)) return 'Transaction cap must be greater than 0.';
  if (!(d.dailyBudgetNear > 0)) return 'Daily budget must be greater than 0.';
  if (d.dailyBudgetNear < d.perTxCapNear) return 'Daily budget cannot be smaller than the per-transaction cap.';
  if (!Number.isInteger(d.maxRiskForAutonomous) || d.maxRiskForAutonomous < 0 || d.maxRiskForAutonomous > 100) return 'Max risk must be a whole number from 0 to 100.';
  return null;
}

export const PolicyStudioScreen: React.FC<PolicyStudioScreenProps> = ({
  vault,
  onUpdatePolicy,
  testnetMode,
  ownerBlockedReason,
  demoScale,
}) => {
  const [perTxCap, setPerTxCap] = useState<number>(vault?.per_tx_cap_near ?? 3);
  const [dailyBudget, setDailyBudget] = useState<number>(vault?.daily_budget_near ?? 10);
  const [requireWhitelist, setRequireWhitelist] = useState<boolean>(vault?.require_whitelist ?? true);
  const [maxRisk, setMaxRisk] = useState<number>(vault?.max_risk_for_autonomous ?? 69);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Follow the on-chain policy until the owner starts editing; never clobber a draft on refresh.
  useEffect(() => {
    if (vault && !dirty) {
      setPerTxCap(vault.per_tx_cap_near);
      setDailyBudget(vault.daily_budget_near);
      setRequireWhitelist(vault.require_whitelist);
      setMaxRisk(vault.max_risk_for_autonomous);
    }
  }, [vault, dirty]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    setError(null);
  };

  const resetDraft = () => {
    setDirty(false);
    setError(null);
  };

  const draft: PolicyDraft = { perTxCapNear: perTxCap, dailyBudgetNear: dailyBudget, requireWhitelist, maxRiskForAutonomous: maxRisk };
  const hasChanges = Boolean(
    vault &&
      (perTxCap !== vault.per_tx_cap_near ||
        dailyBudget !== vault.daily_budget_near ||
        requireWhitelist !== vault.require_whitelist ||
        maxRisk !== vault.max_risk_for_autonomous)
  );
  const validationError = hasChanges ? validate(draft) : null;
  const blockedReason = testnetMode ? ownerBlockedReason : undefined;
  const onChainVersion = vault?.policy_version ?? 1;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || blockedReason) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdatePolicy(draft);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const routine = scenarioAmount('routine', demoScale);
  const spike = scenarioAmount('spike', demoScale);
  const injection = scenarioAmount('injection', demoScale);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Policy Studio</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Hard limits the vault contract enforces on every agent payment
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 rounded-[6px] bg-surface-raised border border-border-subtle text-text-secondary">
            On-chain <span className="text-telemetry-cyan font-semibold">v{onChainVersion}</span>
          </span>
          {hasChanges && (
            <span className="px-3 py-1 rounded-[6px] bg-caution-amberDim/30 border border-caution-amber/30 text-caution-amber">
              Draft → v{onChainVersion + 1}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-telemetry-cyan" />
              Spending limits
            </h2>
            <p className="text-xs text-text-muted">
              Checked by the NEAR contract before any transfer. The agent and backend cannot change them; only the owner's wallet can.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label htmlFor="per-tx-cap" className="block text-xs font-medium text-text-muted mb-1.5">
                  Per-transaction cap (NEAR)
                </label>
                <input
                  id="per-tx-cap"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={perTxCap}
                  onChange={(e) => edit(setPerTxCap)(Number(e.target.value))}
                  className={inputClass}
                />
                <span className="text-[10px] text-text-muted mt-1 block">Anything larger is rejected on-chain.</span>
              </div>

              <div>
                <label htmlFor="daily-budget" className="block text-xs font-medium text-text-muted mb-1.5">
                  Daily budget (NEAR)
                </label>
                <input
                  id="daily-budget"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={dailyBudget}
                  onChange={(e) => edit(setDailyBudget)(Number(e.target.value))}
                  className={inputClass}
                />
                <span className="text-[10px] text-text-muted mt-1 block">
                  Rolling 24-hour window. Spent today: {vault?.daily_spent_near ?? 0} NEAR.
                </span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireWhitelist}
                  onChange={(e) => edit(setRequireWhitelist)(e.target.checked)}
                  className="rounded border-border-subtle bg-[#0B1018] text-telemetry-cyan focus:ring-0"
                />
                <span className="text-xs font-medium text-text-primary">Only pay whitelisted recipients</span>
              </label>
              <p className="text-[11px] text-text-muted ml-6 mt-0.5">
                Payments to accounts outside the whitelist ({vault?.allowed_recipients?.length ?? 0} allowed) are held for owner approval.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-telemetry-cyan" />
              Autonomy threshold
            </h2>
            <p className="text-xs text-text-muted">
              Signed risk scores above this value are held for owner approval instead of paying out automatically.
            </p>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <label htmlFor="max-risk" className="font-medium text-text-muted">Max risk for autonomous payment</label>
                <span className="font-mono text-telemetry-cyan font-semibold">{maxRisk} / 100</span>
              </div>
              <input
                id="max-risk"
                type="range"
                min="30"
                max="85"
                value={maxRisk}
                onChange={(e) => edit(setMaxRisk)(Number(e.target.value))}
                className="w-full accent-telemetry-cyan"
              />
              <div className="flex justify-between text-[10px] text-text-muted font-mono mt-1">
                <span>30 strict</span>
                <span>69 default</span>
                <span>85 permissive</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-card bg-surface-raised border border-border-subtle space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs">
                {validationError ? (
                  <span className="text-blocked-red font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {validationError}
                  </span>
                ) : hasChanges ? (
                  <span className="text-caution-amber font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> Draft not yet on-chain
                  </span>
                ) : (
                  <span className="text-text-muted">Showing the policy currently enforced by the contract</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasChanges && (
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="px-3 py-2 rounded-control border border-border-subtle text-xs text-text-secondary hover:bg-surface-secondary flex items-center gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Discard
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!hasChanges || isSaving || Boolean(validationError) || Boolean(blockedReason)}
                  title={blockedReason}
                  className="px-5 py-2 rounded-control bg-telemetry-cyan text-[#0B1018] hover:bg-telemetry-cyan/90 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : blockedReason ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Waiting for wallet…' : testnetMode ? 'Sign policy update' : 'Save policy'}</span>
                </button>
              </div>
            </div>
            {hasChanges && blockedReason && <p className="text-[11px] text-text-muted">{blockedReason}</p>}
            {error && <p className="text-[11px] text-blocked-red break-words">{error}</p>}
            {testnetMode && hasChanges && !blockedReason && (
              <p className="text-[11px] text-text-muted">
                Your wallet will ask you to sign <span className="font-mono">set_policy</span> (1 yoctoNEAR attached). The policy signer key is kept unchanged.
              </p>
            )}
          </div>
        </form>

        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4 self-start">
          <h2 className="text-sm font-semibold text-text-primary">What this draft means for the demo</h2>
          <p className="text-xs text-text-muted">Expected handling of the three demo invoices under the values on the left.</p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-text-primary">Routine {routine}</span>
                <AuthorityPill level={2} />
              </div>
              <p className="text-[11px] text-confirmed-green">Pays automatically (low risk, within cap and budget).</p>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-text-primary">Spike {spike}</span>
                <AuthorityPill level={5} />
              </div>
              <p className="text-[11px] text-caution-amber">
                {parseFloat(spike) > perTxCap
                  ? `Rejected on-chain: above the ${perTxCap} NEAR cap.`
                  : 'Held for owner approval (amount far above this agent’s usual payments).'}
              </p>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-text-primary">Injection {injection}</span>
                <AuthorityPill level={6} />
              </div>
              <p className="text-[11px] text-blocked-red">
                Rejected on-chain: injection detected, unknown recipient{parseFloat(injection) > perTxCap ? `, above the ${perTxCap} NEAR cap` : ''}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
