import React, { useState, useEffect } from 'react';
import { Vault } from '../api/client';
import { Sliders, Shield, Save, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { AuthorityPill } from '../components/AuthorityPill';

interface PolicyStudioScreenProps {
  vault: Vault | null;
  onUpdatePolicy: (policy: {
    perTxCapNear: number;
    dailyBudgetNear: number;
    requireWhitelist: boolean;
    maxRiskForAutonomous: number;
  }) => Promise<void>;
}

export const PolicyStudioScreen: React.FC<PolicyStudioScreenProps> = ({
  vault,
  onUpdatePolicy,
}) => {
  const [perTxCap, setPerTxCap] = useState<number>(vault?.per_tx_cap_near ?? 10);
  const [dailyBudget, setDailyBudget] = useState<number>(vault?.daily_budget_near ?? 50);
  const [requireWhitelist, setRequireWhitelist] = useState<boolean>(vault?.require_whitelist ?? true);
  const [maxRisk, setMaxRisk] = useState<number>(vault?.max_risk_for_autonomous ?? 69);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (vault) {
      setPerTxCap(vault.per_tx_cap_near);
      setDailyBudget(vault.daily_budget_near);
      setRequireWhitelist(vault.require_whitelist);
      setMaxRisk(vault.max_risk_for_autonomous);
    }
  }, [vault]);

  const hasChanges =
    vault &&
    (perTxCap !== vault.per_tx_cap_near ||
      dailyBudget !== vault.daily_budget_near ||
      requireWhitelist !== vault.require_whitelist ||
      maxRisk !== vault.max_risk_for_autonomous);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdatePolicy({
        perTxCapNear: perTxCap,
        dailyBudgetNear: dailyBudget,
        requireWhitelist,
        maxRiskForAutonomous: maxRisk,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Policy Studio</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure on-chain guardrails, risk thresholds, and attestation rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-[6px] bg-surface-raised border border-border-subtle text-xs font-mono text-text-secondary">
            On-chain Policy: <span className="text-telemetry-cyan font-semibold">v{vault?.policy_version || 1}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main 2/3 Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* Hard Guardrails */}
          <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-telemetry-cyan" />
              On-Chain Hard Guardrails
            </h2>
            <p className="text-xs text-text-muted">
              These immutable parameters are strictly checked by the NEAR smart contract before any transaction can execute.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Single Transaction Cap (NEAR)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={perTxCap}
                  onChange={(e) => setPerTxCap(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0B1018] border border-border-subtle rounded-control text-xs font-mono text-text-primary focus:outline-none focus:border-telemetry-cyan"
                />
                <span className="text-[10px] text-text-muted mt-1 block">
                  Proposals exceeding this are rejected immediately on-chain.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Daily Spend Budget (NEAR)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0B1018] border border-border-subtle rounded-control text-xs font-mono text-text-primary focus:outline-none focus:border-telemetry-cyan"
                />
                <span className="text-[10px] text-text-muted mt-1 block">
                  Resets automatically every 24 hours on-chain.
                </span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireWhitelist}
                  onChange={(e) => setRequireWhitelist(e.target.checked)}
                  className="rounded border-border-subtle bg-[#0B1018] text-telemetry-cyan focus:ring-0"
                />
                <span className="text-xs font-medium text-text-primary">
                  Enforce strict recipient whitelist
                </span>
              </label>
              <p className="text-[11px] text-text-muted ml-6 mt-0.5">
                When enabled, payments to unknown addresses are automatically held for owner approval regardless of risk score.
              </p>
            </div>
          </div>

          {/* Adaptive Risk & Thresholds */}
          <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-telemetry-cyan" />
              Dynamic Authority & Risk Gating
            </h2>
            <p className="text-xs text-text-muted">
              Configure where Throttle transitions payments from autonomous dispatch to human authorization.
            </p>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <label className="font-medium text-text-muted">
                  Max Risk for Autonomous Execution
                </label>
                <span className="font-mono text-telemetry-cyan font-semibold">{maxRisk} / 100</span>
              </div>
              <input
                type="range"
                min="30"
                max="85"
                value={maxRisk}
                onChange={(e) => setMaxRisk(Number(e.target.value))}
                className="w-full accent-telemetry-cyan"
              />
              <div className="flex justify-between text-[10px] text-text-muted font-mono mt-1">
                <span>30 (Strict / Conservative)</span>
                <span>69 (Balanced Recommended)</span>
                <span>85 (Permissive)</span>
              </div>
            </div>
          </div>

          {/* Save Bar */}
          <div className="flex items-center justify-between p-4 rounded-card bg-surface-raised border border-border-subtle">
            <div className="text-xs">
              {hasChanges ? (
                <span className="text-caution-amber font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Unsaved policy draft changes
                </span>
              ) : (
                <span className="text-text-muted">Current policy synced with NEAR contract</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!hasChanges || isSaving}
              className="px-5 py-2 rounded-control bg-telemetry-cyan text-[#0B1018] hover:bg-telemetry-cyan/90 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Updating On-Chain...' : saveSuccess ? 'Policy Saved!' : 'Sign & Update Policy'}</span>
            </button>
          </div>
        </form>

        {/* Right 1/3: Policy Impact Preview */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Policy Impact Simulation</h2>
          <p className="text-xs text-text-muted">
            How these thresholds affect proposed agent actions:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-text-primary">Routine 3 NEAR task</span>
                <AuthorityPill level={1} />
              </div>
              <p className="text-[11px] text-confirmed-green">
                Executes autonomously (Risk ~12 &lt; {maxRisk})
              </p>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-text-primary">Anomalous 25 NEAR task</span>
                <AuthorityPill level={5} />
              </div>
              <p className="text-[11px] text-caution-amber">
                Held for owner approval (Amount &gt; {perTxCap} NEAR cap or Risk &ge; 70)
              </p>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-text-primary">New Unseen Recipient</span>
                <AuthorityPill level={requireWhitelist ? 5 : 3} />
              </div>
              <p className="text-[11px] text-text-muted">
                {requireWhitelist
                  ? 'Held for approval (Strict whitelist enabled)'
                  : 'Requires monitored scrutiny'}
              </p>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-text-primary">Prompt Injection Attack</span>
                <AuthorityPill level={6} />
              </div>
              <p className="text-[11px] text-blocked-red">
                Refused &amp; Blocked unconditionally (Risk ~95)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

