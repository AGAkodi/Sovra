import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, ChevronRight } from 'lucide-react';
import { api, AuditEvent, PaymentRequest } from '../api/client';
import { Card } from '../ui/Surface';
import { Button } from '../ui/Button';
import { INK_BG } from '../design/levels';
import { ActivityGroup, ActivityLine, dayLabel, describeEvent } from '../design/activity';
import { EXPLORER_TX, shortHash, utc } from '../design/format';

interface AuditTrailScreenProps {
  /** Latest events from the app's poll; the screen loads a longer history itself. */
  events: AuditEvent[];
  requests: PaymentRequest[];
  onOpenRequest: (r: PaymentRequest) => void;
}

type Filter = 'all' | ActivityGroup;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'payments', label: 'Payments' },
  { id: 'you', label: 'Your actions' },
  { id: 'system', label: 'System' },
];

const HISTORY = 200;

const ProofLink: React.FC<{ line: ActivityLine }> = ({ line }) => {
  const p = line.proof;
  if (p.kind === 'tx')
    return (
      <a
        href={`${EXPLORER_TX}${p.hash}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 text-caption text-fg-2 hover:text-fg whitespace-nowrap"
        title={p.hash}
      >
        <span className="font-mono text-meta text-fg-3">{shortHash(p.hash)}</span>
        View on NEAR
        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
      </a>
    );
  if (p.kind === 'unverified')
    return (
      <span className="text-caption text-brass whitespace-nowrap" title="This says something happened on NEAR, but there is no transaction to check it against">
        Unverified, no receipt
      </span>
    );
  if (p.kind === 'read') return <span className="text-caption text-fg-3 whitespace-nowrap">Read from the vault</span>;
  if (p.kind === 'simulated') return <span className="text-caption text-fg-3 whitespace-nowrap">Simulated</span>;
  return null;
};

export const AuditTrailScreen: React.FC<AuditTrailScreenProps> = ({ events, requests, onOpenRequest }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [history, setHistory] = useState<AuditEvent[]>([]);

  // Reload the longer history whenever the app sees a new event.
  const newest = events[0]?.id;
  useEffect(() => {
    let cancelled = false;
    api
      .getEvents(HISTORY)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [newest]);

  const all = history.length >= events.length ? history : events;

  const requestsById = useMemo(() => {
    const m = new Map<string, PaymentRequest>();
    requests.forEach((r) => {
      m.set(r.request_id, r);
      m.set(r.id, r);
    });
    return m;
  }, [requests]);

  const lines = useMemo(
    () =>
      all
        .map((e) => ({ e, line: describeEvent(e, requestsById) }))
        .filter(({ line }) => (filter === 'all' ? !line.quiet : line.group === filter)),
    [all, requestsById, filter]
  );

  const days = useMemo(() => {
    const groups: { label: string; items: typeof lines }[] = [];
    for (const item of lines) {
      const label = dayLabel(item.e.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [lines]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovra-activity-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 animate-rise">
        <div>
          <h1 className="font-display text-page text-fg">Activity</h1>
          <p className="mt-1 text-caption text-fg-3">Everything the agent, the vault and you did, newest first. The log can’t be edited</p>
        </div>
        <Button variant="quiet" size="sm" onClick={exportJson} disabled={all.length === 0} icon={<Download className="w-4 h-4" strokeWidth={1.5} />}>
          Export
        </Button>
      </header>

      <div className="inline-flex p-1 rounded-control bg-card border border-line overflow-x-auto self-start max-w-full animate-rise [animation-delay:50ms]" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.id)}
              className={`h-7 px-3 rounded-[6px] text-caption whitespace-nowrap transition-colors duration-hover ease-vault ${
                on ? 'bg-raised text-fg shadow-row-active' : 'text-fg-2 hover:text-fg'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {days.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-body text-fg">{all.length === 0 ? 'Nothing has happened yet' : 'Nothing in this group'}</p>
          <p className="mt-1 text-caption text-fg-3">{all.length === 0 ? 'Run a scenario from Home and it will appear here' : 'Try another filter'}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8 animate-rise [animation-delay:100ms]">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label}>
              <h2 className="text-caption text-fg-3 mb-3">{day.label}</h2>
              <Card padded={false}>
                <ol className="divide-y divide-line">
                  {day.items.map(({ e, line }) => {
                    const req = e.target_id ? requestsById.get(e.target_id) : undefined;
                    const content = (
                      <>
                        <span className="font-mono text-meta text-fg-3 pt-0.5" title={utc(e.timestamp)}>
                          {new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex gap-3 min-w-0">
                          <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${INK_BG[line.ink]}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-body text-fg">{line.sentence}</span>
                            {line.detail && <span className="block text-caption text-fg-3 truncate">{line.detail}</span>}
                          </span>
                        </span>
                        <span className="col-start-2 sm:col-start-auto flex items-center gap-3 sm:justify-end pl-[18px] sm:pl-0">
                          <ProofLink line={line} />
                          {req && <ChevronRight className="hidden sm:block w-4 h-4 text-fg-3" strokeWidth={1.5} aria-hidden="true" />}
                        </span>
                      </>
                    );
                    const cls = 'w-full text-left grid grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[48px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 sm:px-6 py-4';
                    return (
                      <li key={e.id}>
                        {req ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenRequest(req)}
                            onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && onOpenRequest(req)}
                            className={`${cls} cursor-pointer hover:bg-raised/50 transition-colors duration-hover ease-vault`}
                          >
                            {content}
                          </div>
                        ) : (
                          <div className={cls}>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
