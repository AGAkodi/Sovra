import React from 'react';
import { Shield, RefreshCw, Radio, Menu } from 'lucide-react';
import { WalletButton } from '../wallet/WalletButton';

interface TopbarProps {
  onRefresh: () => void;
  lastUpdated: Date;
  isSyncing: boolean;
  vaultContractId?: string;
  ownerId?: string | null;
  testnetMode: boolean;
  connection: 'loading' | 'live' | 'stale' | 'offline';
  onToggleMenu: () => void;
  menuOpen: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  onRefresh,
  lastUpdated,
  isSyncing,
  vaultContractId = 'throttle-vault.testnet',
  ownerId,
  testnetMode,
  connection,
  onToggleMenu,
  menuOpen,
}) => {
  const conn = {
    loading: { dot: 'bg-text-muted', text: 'Connecting…' },
    live: { dot: 'bg-confirmed-green', text: testnetMode ? 'Chain: live' : 'Simulation mode' },
    stale: { dot: 'bg-caution-amber', text: 'Chain: stale' },
    offline: { dot: 'bg-blocked-red', text: 'Backend offline' },
  }[connection];
  return (
    <header className="h-14 border-b border-border-subtle bg-surface-raised/80 backdrop-blur px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-50">
      {/* Brand & Network */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMenu}
          className="md:hidden p-1.5 rounded-control text-text-secondary hover:bg-surface-secondary border border-border-subtle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-control bg-telemetry-cyanDim/50 border border-telemetry-cyan/40 flex items-center justify-center text-telemetry-cyan">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-text-primary whitespace-nowrap">
            THROTTLE<span className="hidden sm:inline"> <span className="text-text-muted font-normal">/</span> NEAR</span>
          </span>
        </div>

        <div className="hidden sm:block h-4 w-[1px] bg-border-subtle mx-1" />

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-secondary border border-border-subtle text-xs text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-confirmed-green" />
          <span>NEAR Testnet</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted font-mono" title={connection === 'stale' ? 'The backend could not re-read the vault contract; showing the last known state.' : undefined}>
          <Radio className="w-3 h-3 text-telemetry-cyan" />
          <span className={`w-1.5 h-1.5 rounded-full ${conn.dot}`} />
          <span>{conn.text}</span>
        </div>
      </div>

      {/* Wallet & Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

