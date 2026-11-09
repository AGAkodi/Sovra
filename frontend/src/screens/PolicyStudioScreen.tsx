import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Vault } from '../api/client';
import { Banner, Card, SectionHead, Sheet } from '../ui/Surface';
import { Button } from '../ui/Button';
import { StatusText } from '../ui/StatusText';
import { near, shortAccount } from '../design/format';

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

function validate(d: PolicyDraft): string | null {
  if (!(d.perTxCapNear > 0)) return 'The most per payment has to be more than 0';
  if (!(d.dailyBudgetNear > 0)) return 'The daily limit has to be more than 0';
  if (d.dailyBudgetNear < d.perTxCapNear) return 'The daily limit can’t be smaller than the most per payment';
  if (!Number.isInteger(d.maxRiskForAutonomous) || d.maxRiskForAutonomous < 0 || d.maxRiskForAutonomous > 100) return 'The risk threshold must be a whole number from 0 to 100';
  return null;
}

/** Demo invoices at the reference sizes, scaled like the backend's scenarios. */
const REFERENCE = { routine: 3, spike: 25, injection: 80 } as const;

type Outcome = { status: string; decidedBy?: 'vault' | 'risk_engine'; note: string };

/** How each demo invoice would be handled under the draft. Mirrors the vault's own checks. */
function preview(d: PolicyDraft, scale: number, spentToday: number) {
  const left = Math.max(0, d.dailyBudgetNear - spentToday);
  const amt = (k: keyof typeof REFERENCE) => Math.round(REFERENCE[k] * scale * 1e6) / 1e6;
  const overCap = (): Outcome => ({ status: 'rejected', decidedBy: 'vault', note: `More than ${near(d.perTxCapNear)} NEAR per payment, so the vault refuses it` });
  const overDay = (): Outcome => ({ status: 'pending_approval', note: `Only ${near(left)} NEAR of today’s limit is left, so the vault asks you` });

  const routine = amt('routine');
  const spike = amt('spike');
  const injection = amt('injection');
  return [
    {
      name: 'Routine invoice',
      amount: routine,
      outcome:
        routine > d.perTxCapNear
          ? overCap()
          : routine > left
            ? overDay()
            : ({ status: 'succeeded', note: 'A normal amount to an approved recipient' } as Outcome),
    },
    {
      name: 'Unusual amount',
      amount: spike,
      outcome:
        spike > d.perTxCapNear
          ? overCap()
          : ({ status: 'pending_approval', note: 'Far above the usual payment, so it waits for you' } as Outcome),
    },
    {
      name: 'Hidden instructions',
      amount: injection,
      outcome:
        injection > d.perTxCapNear
          ? overCap()
          : ({ status: 'rejected', decidedBy: 'vault', note: 'The risk check blocks it and the vault refuses it' } as Outcome),
    },
  ];
}

const Field: React.FC<{ id: string; label: string; help: string; was?: string; children: React.ReactNode }> = ({ id, label, help, was, children }) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-body text-fg">
      {label}
    </label>
    {children}
    <p className="text-caption text-fg-3">
      {help}
      {was && <span className="text-brass"> · was {was}</span>}
    </p>
  </div>
);

const NumberInput: React.FC<{ id: string; value: number; step: number; min: number; onChange: (n: number) => void }> = ({ id, value, step, min, onChange }) => (
  <div className="relative">
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      className="w-full h-11 pl-4 pr-16 rounded-control bg-raised border border-line text-title font-mono text-fg focus:outline-none focus:border-brass/60"
    />
    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption text-fg-3">NEAR</span>
  </div>
);

export const PolicyStudioScreen: React.FC<PolicyStudioScreenProps> = ({ vault, onUpdatePolicy, testnetMode, ownerBlockedReason, demoScale }) => {
  const [perTxCap, setPerTxCap] = useState<number>(vault?.per_tx_cap_near ?? 3);
  const [dailyBudget, setDailyBudget] = useState<number>(vault?.daily_budget_near ?? 10);
  const [requireWhitelist, setRequireWhitelist] = useState<boolean>(vault?.require_whitelist ?? true);
  const [maxRisk, setMaxRisk] = useState<number>(vault?.max_risk_for_autonomous ?? 69);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the vault until you start editing; refreshes never overwrite a draft.
  useEffect(() => {
    if (vault && !dirty) {
      setPerTxCap(vault.per_tx_cap_near);
      setDailyBudget(vault.daily_budget_near);
      setRequireWhitelist(vault.require_whitelist);
      setMaxRisk(vault.max_risk_for_autonomous);
    }
  }, [vault, dirty]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setError(null);
  };
  const discard = () => {
    setDirty(false);
    setError(null);
  };

  const draft: PolicyDraft = { perTxCapNear: perTxCap, dailyBudgetNear: dailyBudget, requireWhitelist, maxRiskForAutonomous: maxRisk };
  const changes: { label: string; from: string; to: string }[] = vault
    ? [
        perTxCap !== vault.per_tx_cap_near && { label: 'Most per payment', from: `${near(vault.per_tx_cap_near)} NEAR`, to: `${near(perTxCap)} NEAR` },
        dailyBudget !== vault.daily_budget_near && { label: 'Daily limit', from: `${near(vault.daily_budget_near)} NEAR`, to: `${near(dailyBudget)} NEAR` },
        requireWhitelist !== vault.require_whitelist && {
          label: 'Approved recipients only',
          from: vault.require_whitelist ? 'On' : 'Off',
          to: requireWhitelist ? 'On' : 'Off',
        },
        maxRisk !== vault.max_risk_for_autonomous && { label: 'Ask me above risk', from: String(vault.max_risk_for_autonomous), to: String(maxRisk) },
      ].filter((c): c is { label: string; from: string; to: string } => Boolean(c))
    : [];
  const hasChanges = changes.length > 0;
  const invalid = hasChanges ? validate(draft) : null;
  const blocked = testnetMode ? ownerBlockedReason : undefined;
  const version = vault?.policy_version ?? 1;
  const rows = preview(draft, demoScale, vault?.daily_spent_near ?? 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onUpdatePolicy(draft);
      setDirty(false);
      setConfirming(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <h1 className="font-display text-page text-fg">Limits</h1>
          <p className="mt-1 text-caption text-fg-3">The rules the vault contract checks on every payment. Only your wallet can change them</p>
        </div>
        <div className="flex items-center gap-3 text-caption">
          <span className="text-fg-3">
            Version <span className="font-mono text-fg-2">{version}</span>
          </span>
          {hasChanges && <span className="text-brass">Unsaved changes</span>}
        </div>
      </header>

      {blocked && hasChanges && <Banner kind="wallet">{blocked.includes('Connect') ? 'Connect your wallet to save these limits' : blocked}</Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
        <Card className="flex flex-col gap-8 animate-rise [animation-delay:50ms]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field
              id="per-payment"
              label="Most per payment"
              help="Anything larger is refused by the vault, whatever the agent says"
              was={vault && perTxCap !== vault.per_tx_cap_near ? `${near(vault.per_tx_cap_near)} NEAR` : undefined}
            >
              <NumberInput id="per-payment" value={perTxCap} step={0.1} min={0.1} onChange={edit(setPerTxCap)} />
            </Field>
            <Field
              id="daily-limit"
              label="Daily limit"
              help={`Over any 24 hours. ${near(vault?.daily_spent_near ?? 0)} NEAR spent so far`}
              was={vault && dailyBudget !== vault.daily_budget_near ? `${near(vault.daily_budget_near)} NEAR` : undefined}
            >
              <NumberInput id="daily-limit" value={dailyBudget} step={0.5} min={0.5} onChange={edit(setDailyBudget)} />
            </Field>
          </div>

          <div className="border-t border-line pt-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p id="whitelist-label" className="text-body text-fg">
                  Approved recipients only
                </p>
                <p className="text-caption text-fg-3">
                  {requireWhitelist
                    ? 'Payments to anyone else wait for you, even when the risk is low'
                    : 'The vault stops holding new recipients by itself. The risk check still asks you about anyone it hasn’t seen'}
                  {vault && requireWhitelist !== vault.require_whitelist && <span className="text-brass"> · was {vault.require_whitelist ? 'on' : 'off'}</span>}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={requireWhitelist}
                aria-labelledby="whitelist-label"
                onClick={() => edit(setRequireWhitelist)(!requireWhitelist)}
                className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors duration-hover ease-vault ${
                  requireWhitelist ? 'bg-brass border-brass' : 'bg-raised border-line-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full transition-transform duration-hover ease-vault ${
                    requireWhitelist ? 'translate-x-5 bg-brass-ink' : 'bg-fg-2'
                  }`}
                />
              </button>
            </div>
            {vault && vault.allowed_recipients.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Approved recipients">
                {vault.allowed_recipients.map((r) => (
                  <li key={r} className="h-7 px-3 inline-flex items-center rounded-control bg-raised border border-line font-mono text-meta text-fg-2" title={r}>
                    {shortAccount(r)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line pt-6 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="max-risk" className="text-body text-fg">
                Ask me above risk
              </label>
              <span className="font-mono text-title text-fg">{maxRisk}</span>
            </div>
            <input
              id="max-risk"
              type="range"
              min={30}
              max={85}
              value={maxRisk}
              onChange={(e) => edit(setMaxRisk)(Number(e.target.value))}
              className="w-full accent-[#c9a86a]"
            />
            <div className="flex justify-between font-mono text-meta text-fg-3">
              <span>30 cautious</span>
              <span>69 default</span>
              <span>85 relaxed</span>
            </div>
            <p className="text-caption text-fg-3">
              Payments the risk check scores above this wait for you
              {vault && maxRisk !== vault.max_risk_for_autonomous && <span className="text-brass"> · was {vault.max_risk_for_autonomous}</span>}
            </p>
          </div>

          <div className="border-t border-line pt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className={`text-caption ${invalid ? 'text-negative' : 'text-fg-3'}`}>
              {invalid ?? (hasChanges ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} not saved yet` : 'These are the limits the vault enforces now')}
            </p>
            <div className="flex gap-2">
              {hasChanges && (
                <Button variant="quiet" onClick={discard}>
                  Discard
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => setConfirming(true)}
                disabled={!hasChanges || Boolean(invalid) || Boolean(blocked)}
                title={blocked}
                icon={blocked ? <Lock className="w-4 h-4" strokeWidth={1.5} /> : undefined}
              >
                Save limits
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col animate-rise [animation-delay:100ms] lg:sticky lg:top-0">
          <SectionHead title="What changes" meta={hasChanges ? 'With your edits' : 'With the current limits'} />
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((r) => (
              <li key={r.name} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-fg">{r.name}</span>
                  <span className="font-mono text-caption text-fg-2">{near(r.amount)} NEAR</span>
                </div>
                <StatusText status={r.outcome.status} decidedBy={r.outcome.decidedBy} />
                <p className="text-caption text-fg-3">{r.outcome.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-meta text-fg-3">The demo scenarios on Home use these invoices</p>
        </Card>
      </div>

      <Sheet
        open={confirming}
        title={`Save limits as version ${version + 1}?`}
        onClose={() => !busy && setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} busy={busy}>
              Save limits
            </Button>
          </>
        }
      >
        <dl className="flex flex-col divide-y divide-line border-y border-line my-2">
          {changes.map((c) => (
            <div key={c.label} className="py-2 flex items-baseline justify-between gap-4">
              <dt className="text-caption text-fg-2">{c.label}</dt>
              <dd className="font-mono text-caption text-fg">
                <span className="text-fg-3">{c.from}</span> → {c.to}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3">
          {testnetMode
            ? 'Your wallet will ask you to sign. The key the vault uses to check the risk decisions stays the same'
            : 'Simulation mode: the limits change locally, nothing is sent to NEAR'}
        </p>
        {error && <p className="mt-2 text-caption text-negative break-words">{error}</p>}
      </Sheet>
    </div>
  );
};
