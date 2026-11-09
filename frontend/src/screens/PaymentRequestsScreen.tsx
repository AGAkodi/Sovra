import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { PaymentRequest } from '../api/client';
import { Card } from '../ui/Surface';
import { PaymentRow } from '../ui/PaymentRow';
import { near } from '../design/format';

interface PaymentRequestsScreenProps {
  requests: PaymentRequest[];
  onSelectRequest: (req: PaymentRequest) => void;
}

type Filter = 'all' | 'paid' | 'waiting' | 'stopped' | 'expired';

const FILTERS: { id: Filter; label: string; match: (r: PaymentRequest) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'paid', label: 'Paid', match: (r) => r.status === 'succeeded' },
  { id: 'waiting', label: 'Waiting', match: (r) => r.status === 'pending_approval' || r.status === 'executing' },
  { id: 'stopped', label: 'Stopped', match: (r) => r.status === 'rejected' || r.status === 'failed' },
  { id: 'expired', label: 'Expired', match: (r) => r.status === 'expired' },
];

export const PaymentRequestsScreen: React.FC<PaymentRequestsScreenProps> = ({ requests, onSelectRequest }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, requests.filter(f.match).length])) as Record<Filter, number>,
    [requests]
  );
  const paidTotal = useMemo(() => requests.filter((r) => r.status === 'succeeded').reduce((s, r) => s + r.amount_near, 0), [requests]);

  const q = query.trim().toLowerCase();
  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = requests.filter(
    (r) =>
      active.match(r) &&
      (!q ||
        r.recipient.toLowerCase().includes(q) ||
        r.request_id.toLowerCase().includes(q) ||
        (r.task_evidence?.prompt ?? '').toLowerCase().includes(q) ||
        (r.agent?.rationale ?? '').toLowerCase().includes(q))
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise">
        <h1 className="font-display text-page text-fg">Payments</h1>
        <p className="mt-1 text-caption text-fg-3">
          {requests.length} {requests.length === 1 ? 'request' : 'requests'} · {near(paidTotal)} NEAR paid
        </p>
      </header>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-rise [animation-delay:50ms]">
        <div className="inline-flex p-1 rounded-control bg-card border border-line overflow-x-auto self-start max-w-full" role="tablist" aria-label="Filter payments">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className={`h-7 px-3 rounded-[6px] text-caption inline-flex items-center gap-2 whitespace-nowrap transition-colors duration-hover ease-vault
                  ${on ? 'bg-raised text-fg shadow-row-active' : 'text-fg-2 hover:text-fg'}`}
              >
                {f.label}
                <span className={`font-mono text-meta ${on ? 'text-fg-2' : 'text-fg-3'}`}>{counts[f.id]}</span>
              </button>
            );
          })}
        </div>

        <label className="relative w-full md:w-72">
          <span className="sr-only">Search payments</span>
          <Search className="w-4 h-4 text-fg-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-9 pl-9 pr-9 rounded-control bg-card border border-line text-body text-fg placeholder:text-fg-3 focus:outline-none focus:border-brass/60 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-fg-3 hover:text-fg"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </label>
      </div>

      <Card padded={false} className="overflow-hidden animate-rise [animation-delay:100ms]">
        <div
          className="hidden md:grid grid-cols-[32px_minmax(0,1fr)_112px_200px_112px] gap-x-4 px-6 h-10 items-center border-b border-line text-meta text-fg-3"
          aria-hidden="true"
        >
          <span />
          <span>Recipient and task</span>
          <span className="text-right">Amount</span>
          <span>Outcome</span>
          <span className="text-right">When</span>
        </div>
        {shown.length > 0 ? (
          <div className="divide-y divide-line">
            {shown.map((r) => (
              <PaymentRow key={r.id} request={r} onOpen={onSelectRequest} />
            ))}
          </div>
        ) : (
          <div className="py-16 px-6 text-center flex flex-col items-center gap-2">
            <p className="text-body text-fg">{requests.length === 0 ? 'No payments yet' : 'No payments match'}</p>
            <p className="text-caption text-fg-3">
              {requests.length === 0 ? 'Run a scenario from Home to see how Sovra handles one' : q ? 'Try another search or filter' : 'Nothing in this group yet'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
