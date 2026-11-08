import React from 'react';
import { Loader2, CheckCircle2, XCircle, ExternalLink, X, Send } from 'lucide-react';
import { useWallet } from './WalletContext';

const EXPLORER = 'https://testnet.nearblocks.io/txns/';

/** Shows the lifecycle of the current owner transaction. Never claims success before execution. */
export const TxToast: React.FC = () => {
  const { tx, clearTx } = useWallet();
  if (tx.phase === 'idle') return null;

  const styles = {
    wallet: { border: 'border-telemetry-cyan/40', icon: <Loader2 className="w-4 h-4 text-telemetry-cyan animate-spin" />, title: 'Confirm in your wallet' },
    submitted: { border: 'border-telemetry-cyan/40', icon: <Send className="w-4 h-4 text-telemetry-cyan" />, title: 'Submitted to NEAR' },
    confirmed: { border: 'border-confirmed-green/40', icon: <CheckCircle2 className="w-4 h-4 text-confirmed-green" />, title: 'Confirmed on-chain' },
    failed: { border: 'border-blocked-red/40', icon: <XCircle className="w-4 h-4 text-blocked-red" />, title: 'Not completed' },
  }[tx.phase];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 p-4 rounded-card bg-surface-raised border ${styles.border} shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-text-primary">{styles.title}</p>
          {tx.label && <p className="text-xs text-text-secondary">{tx.label}</p>}
          {tx.error && <p className="text-xs text-blocked-red break-words">{tx.error}</p>}
          {tx.txHash && (
            <a
              href={`${EXPLORER}${tx.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-mono text-telemetry-cyan hover:underline"
            >
              {tx.txHash.slice(0, 16)}…
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {tx.phase !== 'wallet' && (
          <button onClick={clearTx} aria-label="Dismiss" className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
