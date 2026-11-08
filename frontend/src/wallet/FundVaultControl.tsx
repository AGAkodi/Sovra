import React, { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';

/** Owner deposits testnet NEAR into the vault (demo step 1). */
export const FundVaultControl: React.FC<{
  disabledReason?: string;
  onFund: (amountNear: number) => Promise<void>;
}> = ({ disabledReason, onFund }) => {
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || disabledReason) return;
    setBusy(true);
    try {
      await onFund(value);
    } catch {
      // Error is shown by the transaction toast.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <label htmlFor="fund-amount" className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
        Fund vault
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="fund-amount"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-3 pr-12 py-1.5 rounded-control bg-bg border border-border-subtle text-sm text-text-primary tabular-nums focus:outline-none focus:border-telemetry-cyan/60"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">NEAR</span>
        </div>
        <button
          type="submit"
          disabled={!valid || busy || !!disabledReason}
          title={disabledReason}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-secondary border border-border-subtle text-xs font-medium text-text-primary hover:border-telemetry-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Deposit
        </button>
      </div>
      {disabledReason && <p className="text-[11px] text-text-muted">{disabledReason}</p>}
    </form>
  );
};
