import React, { useState } from 'react';
import { Home, CheckSquare, Layers, ScrollText, Bot, SlidersHorizontal, Settings, Snowflake, Play, X, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Surface';

export type ScreenId = 'home' | 'approvals' | 'payments' | 'activity' | 'agent' | 'limits' | 'settings';

interface SidebarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  waitingCount: number;
  isFrozen: boolean;
  onToggleFreeze: () => Promise<void> | void;
  /** When set, the freeze control is disabled and this explains why. */
  freezeBlockedReason?: string;
  /** Below md the sidebar is an off-canvas drawer. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV: { id: ScreenId; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'payments', label: 'Payments', icon: Layers },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'limits', label: 'Limits', icon: SlidersHorizontal },
];

/** The Sovra wordmark with its notch glyph. */
export const Wordmark: React.FC = () => (
  <a href="/" className="inline-flex items-center gap-2.5" aria-label="Sovra home">
    <img src="/sovra-mark.svg" alt="" width={24} height={24} className="w-6 h-6" />
    <span className="text-[17px] leading-none font-medium tracking-[-0.01em] text-fg">Sovra</span>
  </a>
);

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  waitingCount,
  isFrozen,
  onToggleFreeze,
  freezeBlockedReason,
  mobileOpen,
  onCloseMobile,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = (id: ScreenId) => {
    onNavigate(id);
    onCloseMobile();
  };

  const confirmFreeze = async () => {
    setBusy(true);
    try {
      await onToggleFreeze();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const navButton = (id: ScreenId, label: string, Icon: (typeof NAV)[number]['icon'], badge?: number) => {
    const active = currentScreen === id;
    return (
      <button
        key={id}
        onClick={() => go(id)}
        aria-current={active ? 'page' : undefined}
        className={`w-full h-9 flex items-center gap-2.5 px-3 rounded-control text-body transition-colors duration-hover ease-vault
          ${active ? 'bg-raised text-fg shadow-row-active' : 'text-fg-2 hover:text-fg hover:bg-raised/60'}`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-fg-2' : 'text-fg-3'}`} strokeWidth={1.5} />
        <span className="flex-1 text-left">{label}</span>
        {badge ? (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-brass text-brass-ink font-mono text-meta inline-flex items-center justify-center">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden animate-fade" onClick={onCloseMobile} aria-hidden="true" />}
      <aside
        id="app-sidebar"
        className={`w-64 shrink-0 bg-canvas-deep border-r border-line flex flex-col
          fixed md:static inset-y-0 left-0 z-40 h-dvh md:h-auto transition-transform duration-sheet ease-vault
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="h-16 px-5 flex items-center justify-between shrink-0">
          <Wordmark />
          <button onClick={onCloseMobile} className="md:hidden p-1 text-fg-3 hover:text-fg" aria-label="Close menu">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => navButton(n.id, n.label, n.icon, n.id === 'approvals' ? waitingCount : undefined))}
        </nav>

        <div className="px-3 pb-3 flex flex-col gap-3">
          {navButton('settings', 'Settings', Settings)}

          <div className="rounded-card border border-line bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isFrozen ? 'bg-frozen' : 'bg-positive'}`} aria-hidden="true" />
              <span className="text-caption text-fg">{isFrozen ? 'Spending is frozen' : 'Spending is on'}</span>
            </div>
            <p className="text-meta text-fg-3">
              {isFrozen ? 'Your agent can’t pay anyone until you unfreeze' : 'Freeze stops every agent payment at once'}
            </p>
            <Button
              variant={isFrozen ? 'secondary' : 'destructive'}
              size="sm"
              icon={isFrozen ? <Play className="w-4 h-4" strokeWidth={1.5} /> : <Snowflake className="w-4 h-4" strokeWidth={1.5} />}
              onClick={() => setConfirming(true)}
              disabled={Boolean(freezeBlockedReason)}
              title={freezeBlockedReason}
            >
              {isFrozen ? 'Unfreeze' : 'Freeze spending'}
            </Button>
            {freezeBlockedReason && <p className="text-meta text-fg-3">{freezeBlockedReason}</p>}
          </div>
        </div>
      </aside>

      <Sheet
        open={confirming}
        title={isFrozen ? 'Unfreeze spending?' : 'Freeze spending?'}
        onClose={() => !busy && setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={isFrozen ? 'primary' : 'danger-fill'} onClick={confirmFreeze} busy={busy}>
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </Button>
          </>
        }
      >
        {isFrozen
          ? 'Your agent will be able to pay again, inside your limits. You’ll sign this in your wallet.'
          : 'Your agent won’t be able to pay anyone until you unfreeze. Payments waiting for you stay on hold. You’ll sign this in your wallet.'}
      </Sheet>
    </>
  );
};
