import React from 'react';
import { RefreshCw, Menu } from 'lucide-react';
import { WalletButton } from '../wallet/WalletButton';
import { Wordmark } from './Sidebar';

export type Connection = 'loading' | 'live' | 'stale' | 'offline';

interface TopbarProps {
  onRefresh: () => void;
  lastUpdated: Date;
  isSyncing: boolean;
  ownerId?: string | null;
  testnetMode: boolean;
  connection: Connection;
  onToggleMenu: () => void;
  menuOpen: boolean;
}

const CONNECTION: Record<Connection, { dot: string; text: string; title: string }> = {
  loading: { dot: 'bg-fg-3', text: 'Connecting', title: 'Reading the vault from NEAR testnet' },
  live: { dot: 'bg-positive', text: 'Live on NEAR testnet', title: 'Balances and limits are read from the vault contract' },
  stale: { dot: 'bg-brass', text: 'Showing last known state', title: "NEAR couldn't be reached just now; the vault still enforces its own rules" },
  offline: { dot: 'bg-negative', text: 'Offline', title: "Sovra's server can't be reached; retrying every 8 seconds" },
};

/** Header inside the content column: connection, wallet and refresh. Page titles live in each screen. */
export const Topbar: React.FC<TopbarProps> = ({ onRefresh, lastUpdated, isSyncing, ownerId, testnetMode, connection, onToggleMenu, menuOpen }) => {
  const c = CONNECTION[connection];
  const label = connection === 'live' && !testnetMode ? 'Simulation mode' : c.text;
  return (
    <header className="h-16 shrink-0 px-4 sm:px-8 flex items-center justify-between gap-3 border-b border-line bg-canvas">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMenu}
          className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-control text-fg-2 hover:bg-raised border border-line"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Menu className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <span className="md:hidden">
          <Wordmark />
        </span>
        <span className="hidden md:inline-flex items-center gap-2 text-caption text-fg-3" title={c.title}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <WalletButton ownerId={ownerId} testnetMode={testnetMode} />
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="h-8 w-8 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised transition-colors duration-hover ease-vault disabled:opacity-60"
          title={`Refresh · updated ${lastUpdated.toLocaleTimeString()}`}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
};
