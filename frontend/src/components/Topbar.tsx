import React from 'react';
import { Shield, RefreshCw, Radio } from 'lucide-react';
import { WalletButton } from '../wallet/WalletButton';

interface TopbarProps {
  onRefresh: () => void;
  lastUpdated: Date;
  isSyncing: boolean;
  vaultContractId?: string;
  ownerId?: string | null;
  testnetMode: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  onRefresh,
  lastUpdated,
  isSyncing,
  vaultContractId = 'throttle-vault.testnet',
  ownerId,
  testnetMode,
}) => {
  return (
    <header className="h-14 border-b border-border-subtle bg-surface-raised/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Network */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-control bg-telemetry-cyanDim/50 border border-telemetry-cyan/40 flex items-center justify-center text-telemetry-cyan">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-text-primary">
            THROTTLE <span className="text-text-muted font-normal">/</span> NEAR
          </span>
        </div>

        <div className="h-4 w-[1px] bg-border-subtle mx-1" />

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-secondary border border-border-subtle text-xs text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-confirmed-green animate-pulse" />
          <span>NEAR Testnet</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-xs text-text-muted font-mono">
          <Radio className="w-3 h-3 text-telemetry-cyan" />
          <span>RPC: Live</span>
        </div>
      </div>

      {/* Wallet & Controls */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-control bg-surface-secondary border border-border-subtle text-xs font-mono">
          <span className="text-text-muted">Vault:</span>
          <span className="text-text-secondary truncate max-w-[140px]">{vaultContractId}</span>
        </div>

        <WalletButton ownerId={ownerId} testnetMode={testnetMode} />

        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-secondary border border-border-subtle transition-colors disabled:opacity-50"
          title={`Last updated: ${lastUpdated.toLocaleTimeString()}`}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-telemetry-cyan' : ''}`} />
        </button>
      </div>
    </header>
  );
};

