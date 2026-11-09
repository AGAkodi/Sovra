import React from 'react';
import { statusWords } from '../design/status';
import { INK_BG, INK_TEXT } from '../design/levels';
import type { PaymentRequest } from '../api/client';

/** A small dot plus the status in plain words. No pill background. */
export const StatusText: React.FC<{
  status: string;
  decidedBy?: PaymentRequest['decided_by'];
  chainMode?: 'testnet' | 'simulation';
  chainReason?: string;
  className?: string;
}> = ({ status, decidedBy, chainMode, chainReason, className = '' }) => {
  const w = statusWords(status, decidedBy, chainMode, chainReason);
  return (
    <span className={`inline-flex items-center gap-2 text-caption whitespace-nowrap ${INK_TEXT[w.ink]} ${className}`} title={w.detail}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${INK_BG[w.ink]}`} aria-hidden="true" />
      {w.label}
    </span>
  );
};
