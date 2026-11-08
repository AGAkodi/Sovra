import React from 'react';
import { CheckCircle2, Clock, XCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  /** 'simulation' results were never broadcast and must not read as chain confirmations. */
  chainMode?: 'testnet' | 'simulation';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, chainMode }) => {
  const norm = status.toLowerCase();

  if (chainMode === 'simulation' && (norm === 'succeeded' || norm === 'confirmed')) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-border-subtle bg-surface-secondary text-text-secondary text-xs font-medium"
        title="Simulation mode: no transaction was broadcast"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Simulated, not onchain</span>
      </span>
    );
  }

  if (norm === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-border-subtle bg-surface-secondary text-text-muted text-xs font-medium">
        <Clock className="w-3.5 h-3.5" />
        <span>Approval Expired</span>
      </span>
    );
  }

  if (norm === 'succeeded' || norm === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-confirmed-green/30 bg-confirmed-greenDim/30 text-confirmed-green text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Confirmed Onchain</span>
      </span>
    );
  }

  if (norm === 'pending_approval' || norm === 'needs approval') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-caution-amber/30 bg-caution-amberDim/30 text-caution-amber text-xs font-medium">
        <Clock className="w-3.5 h-3.5" />
        <span>Needs Approval</span>
      </span>
    );
  }

  if (norm === 'executing') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-telemetry-cyan/30 bg-telemetry-cyanDim/30 text-telemetry-cyan text-xs font-medium">
        <ArrowUpRight className="w-3.5 h-3.5" />
        <span>Executing</span>
      </span>
    );
  }

  if (norm === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-blocked-red/30 bg-blocked-redDim/30 text-blocked-red text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" />
        <span>Rejected</span>
      </span>
    );
  }

  if (norm === 'blocked' || norm === 'blocked by vault') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-blocked-red/40 bg-blocked-redDim/40 text-blocked-red text-xs font-medium">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Blocked by Vault</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border border-border-subtle bg-surface-secondary text-text-muted text-xs font-medium">
      <XCircle className="w-3.5 h-3.5" />
      <span className="capitalize">{status}</span>
    </span>
  );
};

