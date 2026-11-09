import React from 'react';
import { Wallet, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useWallet } from './WalletContext';

function truncate(id: string, max = 26): string {
  return id.length <= max ? id : `${id.slice(0, 12)}…${id.slice(-11)}`;
}

/** Topbar control: connect the owner wallet, show whether it is the vault owner. */
export const WalletButton: React.FC<{ ownerId?: string | null; testnetMode: boolean }> = ({ ownerId, testnetMode }) => {
  const { ready, accountId, isOwner, connect, disconnect } = useWallet();

  if (!testnetMode) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-control bg-surface-secondary border border-border-subtle text-xs text-text-muted"
        title="Backend is in simulation mode; owner actions are simulated locally."
      >
        <Wallet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Simulation mode</span>
      </div>
    );
  }

  if (!accountId) {
    return (
      <button
        onClick={connect}
        disabled={!ready}
        className="flex items-center gap-2 px-3 py-1 rounded-control bg-telemetry-cyanDim/40 border border-telemetry-cyan/40 text-xs font-medium text-telemetry-cyan hover:bg-telemetry-cyanDim/60 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-telemetry-cyan/60"
      >
        <Wallet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{ready ? 'Connect owner wallet' : 'Loading wallets…'}</span>
        <span className="sm:hidden">{ready ? 'Connect' : '…'}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-control border text-xs font-mono ${
          isOwner ? 'bg-confirmed-greenDim/30 border-confirmed-green/40' : 'bg-caution-amberDim/30 border-caution-amber/40'
        }`}
        title={isOwner ? 'Connected as the vault owner' : `Connected account is not the vault owner (${ownerId ?? 'unknown'})`}
      >
        {isOwner ? (
          <ShieldCheck className="w-3.5 h-3.5 text-confirmed-green" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-caution-amber" />
        )}
        <span className="text-text-primary hidden sm:inline">{truncate(accountId)}</span>
        <span className={`font-sans ${isOwner ? 'text-confirmed-green' : 'text-caution-amber'}`}>
          {isOwner ? 'Owner' : 'Not owner'}
        </span>
      </div>
      <button
        onClick={() => void disconnect()}
        className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-secondary border border-border-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-telemetry-cyan/60"
        title="Disconnect wallet"
        aria-label="Disconnect wallet"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
