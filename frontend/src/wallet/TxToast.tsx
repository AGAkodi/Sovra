import React from 'react';
import { Loader2, Check, X, ExternalLink, Send } from 'lucide-react';
import { useWallet } from './WalletContext';
import { EXPLORER_TX, shortHash } from '../design/format';

/** Progress of the owner's current wallet transaction. Never claims success before execution. */
export const TxToast: React.FC = () => {
  const { tx, clearTx } = useWallet();
  if (tx.phase === 'idle') return null;

  const phase = {
    wallet: { icon: <Loader2 className="w-4 h-4 text-fg-2 animate-spin" strokeWidth={1.5} />, title: 'Waiting for your wallet' },
    submitted: { icon: <Send className="w-4 h-4 text-fg-2" strokeWidth={1.5} />, title: 'Sent to NEAR' },
    confirmed: { icon: <Check className="w-4 h-4 text-positive" strokeWidth={1.5} />, title: 'Done' },
    failed: { icon: <X className="w-4 h-4 text-negative" strokeWidth={1.5} />, title: 'Not completed' },
  }[tx.phase];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 p-4 rounded-card bg-card border border-line shadow-lift animate-sheet-in"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-4">{phase.icon}</div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="text-body text-fg">{phase.title}</p>
          {tx.label && <p className="text-caption text-fg-2">{tx.label}</p>}
          {tx.error && <p className="text-caption text-negative break-words">{tx.error}</p>}
          {tx.txHash && (
            <a href={`${EXPLORER_TX}${tx.txHash}`} target="_blank" rel="noreferrer" className="self-start inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg">
              View on NEAR <span className="font-mono text-fg-3">{shortHash(tx.txHash)}</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
        {tx.phase !== 'wallet' && (
          <button onClick={clearTx} aria-label="Dismiss" className="text-fg-3 hover:text-fg">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};
