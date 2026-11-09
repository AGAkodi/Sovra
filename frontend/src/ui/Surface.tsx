import React from 'react';
import { AlertTriangle, Snowflake, WifiOff, ArrowRight } from 'lucide-react';

/** A card on the page: surface step plus hairline, no shadow. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }> = ({
  padded = true,
  className = '',
  children,
  ...rest
}) => (
  <div className={`rounded-card bg-card border border-line ${padded ? 'p-6' : ''} ${className}`} {...rest}>
    {children}
  </div>
);

/** Section heading row: title on the left, an optional action on the right. */
export const SectionHead: React.FC<{ title: string; meta?: React.ReactNode; action?: React.ReactNode }> = ({ title, meta, action }) => (
  <div className="flex items-baseline justify-between gap-4 mb-4">
    <div className="flex items-baseline gap-3 min-w-0">
      <h2 className="text-title font-medium text-fg">{title}</h2>
      {meta && <span className="text-caption text-fg-3 truncate">{meta}</span>}
    </div>
    {action}
  </div>
);

/** Stat: label, figure, context line. Numbers only, no decoration. */
export const Stat: React.FC<{ label: string; figure: React.ReactNode; context?: React.ReactNode; className?: string }> = ({
  label,
  figure,
  context,
  className = '',
}) => (
  <Card className={`flex flex-col gap-2 ${className}`}>
    <span className="text-caption text-fg-2">{label}</span>
    <span className="font-mono text-figure font-medium text-fg">{figure}</span>
    {context && <span className="text-meta text-fg-3">{context}</span>}
  </Card>
);

type BannerKind = 'waiting' | 'frozen' | 'offline' | 'stale';

const BANNER: Record<BannerKind, { cls: string; icon: React.ReactNode }> = {
  waiting: { cls: 'border-brass/40 text-fg', icon: <span className="w-1.5 h-1.5 rounded-full bg-brass" /> },
  frozen: { cls: 'border-frozen/40 text-fg', icon: <Snowflake className="w-4 h-4 text-frozen" strokeWidth={1.5} /> },
  offline: { cls: 'border-negative/40 text-fg', icon: <WifiOff className="w-4 h-4 text-negative" strokeWidth={1.5} /> },
  stale: { cls: 'border-line-strong text-fg-2', icon: <AlertTriangle className="w-4 h-4 text-fg-3" strokeWidth={1.5} /> },
};

export const Banner: React.FC<{ kind: BannerKind; children: React.ReactNode; action?: { label: string; onClick: () => void } }> = ({
  kind,
  children,
  action,
}) => (
  <div
    role={kind === 'offline' ? 'alert' : 'status'}
    className={`flex items-center gap-3 rounded-card bg-card border px-4 py-3 text-body animate-fade ${BANNER[kind].cls}`}
  >
    <span className="w-4 flex justify-center shrink-0">{BANNER[kind].icon}</span>
    <span className="flex-1 min-w-0">{children}</span>
    {action && (
      <button
        onClick={action.onClick}
        className="inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg transition-colors duration-hover ease-vault shrink-0"
      >
        {action.label}
        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
      </button>
    )}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-control bg-raised/70 ${className}`} aria-hidden="true" />
);

/** Bottom sheet on phones, centred dialog on desktop, for confirmations. */
export const Sheet: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}> = ({ open, title, onClose, children, footer }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-line rounded-t-panel sm:rounded-panel p-6 shadow-lift animate-sheet-in">
        <h2 className="text-title font-medium text-fg">{title}</h2>
        <div className="mt-2 text-body text-fg-2">{children}</div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
};
