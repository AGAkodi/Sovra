import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Layers,
  CheckSquare,
  Sliders,
  FileText,
  Settings,
  Lock,
  Unlock,
  X,
} from 'lucide-react';

export type ScreenId = 'overview' | 'agent' | 'payments' | 'approvals' | 'policies' | 'audit' | 'settings';

interface SidebarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  pendingApprovalsCount: number;
  isFrozen: boolean;
  onToggleFreeze: () => void;
  /** When set, the freeze control is disabled and this explains why. */
  freezeBlockedReason?: string;
  /** Below md the sidebar is an off-canvas drawer. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  pendingApprovalsCount,
  isFrozen,
  onToggleFreeze,
  freezeBlockedReason,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'overview' as ScreenId, label: 'Overview', icon: LayoutDashboard },
    { id: 'agent' as ScreenId, label: 'Agent Monitor', icon: Activity },
    { id: 'payments' as ScreenId, label: 'Payment Requests', icon: Layers },
    {
      id: 'approvals' as ScreenId,
      label: 'Approvals',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { id: 'policies' as ScreenId, label: 'Policy Studio', icon: Sliders },
    { id: 'audit' as ScreenId, label: 'Audit Trail', icon: FileText },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings },
  ];

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 top-14 z-30 bg-black/60 md:hidden" onClick={onCloseMobile} aria-hidden="true" />}
    <aside
      id="app-sidebar"
      className={`w-64 md:w-60 border-r border-border-subtle bg-surface-raised flex flex-col justify-between gap-4 p-4 shrink-0 overflow-y-auto
        fixed md:sticky top-14 left-0 z-40 h-[calc(100dvh-3.5rem)] transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
    >
      {/* Nav List */}
      <nav className="space-y-1">
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wider text-text-muted uppercase">Navigation</span>
          <button onClick={onCloseMobile} className="md:hidden p-1 text-text-muted hover:text-text-primary" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-control text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-surface-secondary text-text-primary border border-border-subtle font-semibold shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-telemetry-cyan' : 'text-text-muted'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-caution-amber text-[#0B1018] font-mono text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Emergency Killswitch Panel */}
      <div className="p-3 rounded-card bg-[#0B1018] border border-border-subtle space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted">Emergency Freeze</span>
          <span className={`w-2 h-2 rounded-full ${isFrozen ? 'bg-blocked-red animate-ping' : 'bg-confirmed-green'}`} />
        </div>
        <p className="text-[11px] text-text-muted leading-tight">
          {isFrozen
            ? 'Vault execution suspended. Agent proposals rejected.'
            : 'Autonomous spending active within guardrails.'}
        </p>
        <button
          onClick={onToggleFreeze}
          disabled={!!freezeBlockedReason}
          title={freezeBlockedReason}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-control text-xs font-medium transition-colors border ${
            isFrozen
              ? 'bg-confirmed-greenDim border-confirmed-green/40 text-confirmed-green hover:bg-confirmed-greenDim/80'
              : 'bg-blocked-redDim border-blocked-red/40 text-blocked-red hover:bg-blocked-redDim/80'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isFrozen ? (
            <>
              <Unlock className="w-3.5 h-3.5" />
              <span>Release Freeze</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Freeze Agent</span>
            </>
          )}
        </button>
        {freezeBlockedReason && <p className="text-[11px] text-text-muted leading-tight">{freezeBlockedReason}</p>}
      </div>
    </aside>
    </>
  );
};

