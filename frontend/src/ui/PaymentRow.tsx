import React from 'react';
import type { PaymentRequest } from '../api/client';
import { StatusText } from './StatusText';
import { near, relativeTime, shortAccount, taskLine, utc } from '../design/format';

/** Initial of the recipient, on a raised square: quiet, no color per person. */
export const RecipientMark: React.FC<{ account: string }> = ({ account }) => (
  <span className="w-8 h-8 shrink-0 rounded-control bg-raised border border-line inline-flex items-center justify-center text-caption text-fg-2 uppercase">
    {shortAccount(account).replace(/^sovra-/, '').charAt(0) || '?'}
  </span>
);

/** One payment: who, what for, how much, what happened, when. Level and IDs live in the drawer. */
export const PaymentRow: React.FC<{ request: PaymentRequest; onOpen: (r: PaymentRequest) => void }> = ({ request: r, onOpen }) => (
  <button
    onClick={() => onOpen(r)}
    className="w-full text-left grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,1fr)_112px_200px_112px] items-center gap-x-4 gap-y-1 px-4 md:px-6 py-3 md:h-16 md:py-0
      hover:bg-raised/50 transition-colors duration-hover ease-vault focus-visible:bg-raised/50"
  >
    <RecipientMark account={r.recipient} />
    <span className="min-w-0">
      <span className="block text-body text-fg truncate">{shortAccount(r.recipient)}</span>
      <span className="block text-meta text-fg-3 truncate">{taskLine(r.task_evidence?.prompt) || 'Payment'}</span>
    </span>
    <span className="font-mono text-body text-fg text-right whitespace-nowrap">{near(r.amount_near)} NEAR</span>
    <span className="col-start-2 md:col-start-auto">
      <StatusText status={r.status} decidedBy={r.decided_by} chainMode={r.chain_mode} chainReason={r.chain_reason} />
    </span>
    <span className="text-meta text-fg-3 text-right md:text-right whitespace-nowrap" title={utc(r.created_at)}>
      {relativeTime(r.created_at)}
    </span>
  </button>
);
