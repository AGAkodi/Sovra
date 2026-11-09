import React from 'react';
import { CheckCircle2, Clock, XCircle, AlertTriangle, ArrowUpRight, ShieldX, UserX, WifiOff, Ban } from 'lucide-react';
import type { PaymentRequest } from '../api/client';

interface StatusBadgeProps {
  status: string;
  /** 'simulation' results were never broadcast and must not read as chain confirmations. */
  chainMode?: 'testnet' | 'simulation';
  /** Who made the final call; turns a bare "Rejected" into who stopped it. */
  decidedBy?: PaymentRequest['decided_by'];
}

type Tone = 'green' | 'amber' | 'cyan' | 'red' | 'muted';

const TONES: Record<Tone, string> = {
  green: 'border-confirmed-green/30 bg-confirmed-greenDim/30 text-confirmed-green',
  amber: 'border-caution-amber/30 bg-caution-amberDim/30 text-caution-amber',
  cyan: 'border-telemetry-cyan/30 bg-telemetry-cyanDim/30 text-telemetry-cyan',
  red: 'border-blocked-red/30 bg-blocked-redDim/30 text-blocked-red',
  muted: 'border-border-subtle bg-surface-secondary text-text-muted',
};

interface Display {
  label: string;
  tone: Tone;
  Icon: React.ComponentType<{ className?: string }>;
  title?: string;
}

/** Maps a request's status and decider to the label shown everywhere a status appears. */
export function describeStatus(status: string, chainMode?: 'testnet' | 'simulation', decidedBy?: PaymentRequest['decided_by']): Display {
  const norm = status.toLowerCase();
  const sim = chainMode === 'simulation';

  if (norm === 'succeeded' || norm === 'confirmed') {
    return sim
      ? { label: 'Simulated, not onchain', tone: 'muted', Icon: AlertTriangle, title: 'Simulation mode: no transaction was broadcast' }
      : { label: decidedBy === 'owner' ? 'Owner approved · paid' : 'Confirmed onchain', tone: 'green', Icon: CheckCircle2 };
  }
  if (norm === 'pending_approval') return { label: 'Needs approval', tone: 'amber', Icon: Clock };
  if (norm === 'executing') return { label: 'Executing', tone: 'cyan', Icon: ArrowUpRight };
  if (norm === 'expired') return { label: 'Approval expired', tone: 'muted', Icon: Clock, title: 'The owner did not act before the vault deadline; funds were released.' };
  if (norm === 'declined') return { label: 'Agent declined', tone: 'muted', Icon: Ban, title: 'The LLM refused to propose a payment; nothing was submitted.' };

  if (norm === 'rejected') {
    switch (decidedBy) {
      case 'vault':
        return { label: 'Rejected onchain', tone: 'red', Icon: ShieldX, title: 'The vault contract recorded this request as rejected.' };
      case 'vault_refused':
        return { label: 'Refused by vault', tone: 'red', Icon: AlertTriangle, title: 'The vault call failed (e.g. frozen or insufficient balance); nothing was recorded or paid.' };
      case 'owner':
        return { label: 'Rejected by owner', tone: 'red', Icon: UserX, title: 'The vault owner rejected this held request.' };
      case 'risk_engine':
        return { label: sim ? 'Blocked by risk engine (sim)' : 'Blocked by risk engine', tone: 'red', Icon: XCircle };
      default:
        return { label: 'Rejected', tone: 'red', Icon: XCircle };
    }
  }

  if (norm === 'failed') {
    return decidedBy === 'rpc_error'
      ? { label: 'RPC error · outcome unknown', tone: 'amber', Icon: WifiOff, title: 'NEAR RPC could not be reached; nothing is assumed about the outcome.' }
      : { label: 'Transfer failed onchain', tone: 'red', Icon: XCircle };
  }

  return { label: status.replace(/_/g, ' '), tone: 'muted', Icon: XCircle };
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, chainMode, decidedBy }) => {
  const { label, tone, Icon, title } = describeStatus(status, chainMode, decidedBy);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] border text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
      title={title}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="first-letter:uppercase">{label}</span>
    </span>
  );
};
