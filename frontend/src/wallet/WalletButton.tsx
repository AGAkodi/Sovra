import React from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { useWallet } from './WalletContext';
import { Button } from '../ui/Button';
import { shortAccount } from '../design/format';

/** Header control: connect the owner wallet; shows whether it is the vault owner. */
export const WalletButton: React.FC<{ ownerId?: string | null; testnetMode: boolean }> = ({ ownerId, testnetMode }) => {
  const { ready, accountId, isOwner, connect, disconnect } = useWallet();

  if (!testnetMode) {
    return (
      <span className="text-caption text-fg-3" title="The backend is in simulation mode; owner actions are simulated">
        Simulation mode
      </span>
    );
  }

  if (!accountId) {
    return (
      <Button variant="secondary" size="sm" onClick={connect} disabled={!ready} icon={<Wallet className="w-4 h-4" strokeWidth={1.5} />}>
        <span className="hidden sm:inline">{ready ? 'Connect wallet' : 'Loading wallets'}</span>
        <span className="sm:hidden">{ready ? 'Connect' : '…'}</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className="h-8 inline-flex items-center gap-2 px-3 rounded-control bg-card border border-line text-caption"
        title={isOwner ? 'Connected as the vault owner' : `This account doesn't own the vault (owner: ${ownerId ?? 'unknown'})`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOwner ? 'bg-positive' : 'bg-brass'}`} aria-hidden="true" />
        <span className="font-mono text-fg hidden sm:inline">{shortAccount(accountId)}</span>
        <span className="text-fg-3">{isOwner ? 'Owner' : 'Not the owner'}</span>
      </span>
      <button
        onClick={() => void disconnect()}
        className="h-8 w-8 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised transition-colors duration-hover ease-vault"
        title="Disconnect wallet"
        aria-label="Disconnect wallet"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  );
};
