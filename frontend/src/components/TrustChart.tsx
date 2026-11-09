import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TrustPoint } from '../api/client';

/**
 * Trust over time (Agent screen moment): one brass line on a muted grid, the
 * trust each level needs as faint guides, and a note on every change.
 */
const H = 260;
const PAD = { top: 16, right: 64, bottom: 28, left: 36 };
const GUIDES: { at: number; label: string }[] = [
  { at: 80, label: 'Level 1' },
  { at: 65, label: 'Level 2' },
  { at: 50, label: 'Level 3' },
  { at: 35, label: 'Level 4' },
];

export const TrustChart: React.FC<{ points: TrustPoint[] }> = ({ points }) => {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so labels stay 11px on every screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [points.length >= 2]);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const t0 = points[0].t;
    const t1 = Math.max(points[points.length - 1].t, t0 + 3_600_000);
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - v / 100) * (H - PAD.top - PAD.bottom);
    const xy = points.map((p) => ({ x: x(p.t), y: y(p.trust) }));
    // Day ticks at local midnights inside the range, plus the start.
    const ticks: { x: number; label: string }[] = [];
    const start = new Date(t0);
    start.setHours(24, 0, 0, 0);
    for (let t = start.getTime(); t < t1; t += 86_400_000) {
      ticks.push({ x: x(t), label: new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    }
    return { x, y, xy, ticks };
  }, [points, W]);

  if (!geo || points.length < 2) {
    return (
      <div ref={box} className="h-[260px] flex items-center justify-center text-caption text-fg-3">
        Not enough history yet
      </div>
    );
  }

  const { y, xy, ticks } = geo;
  // Straight segments: trust changes in steps, and a curve would invent values between them.
  const line = xy.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${xy[xy.length - 1].x} ${H - PAD.bottom} L ${xy[0].x} ${H - PAD.bottom} Z`;
  const last = xy[xy.length - 1];
  const hp = hover !== null ? points[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.x - mx) < Math.abs(xy[best].x - mx)) best = i;
    });
    setHover(best);
  };

  return (
    <div ref={box} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`Trust over time, now ${points[points.length - 1].trust} out of 100`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a86a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#c9a86a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid: 0, 50, 100 and the level guides */}
        {[0, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgb(237 237 237 / 0.08)" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-fg-3 font-mono" fontSize="11">
              {v}
            </text>
          </g>
        ))}
        {GUIDES.map((g) => (
          <g key={g.at}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g.at)} y2={y(g.at)} stroke="rgb(237 237 237 / 0.07)" strokeDasharray="2 4" />
            <text x={W - PAD.right + 8} y={y(g.at) + 4} className="fill-fg-3" fontSize="11">
              {g.label}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={t.x} x2={t.x} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(237 237 237 / 0.05)" />
            <text x={t.x} y={H - 8} textAnchor="middle" className="fill-fg-3 font-mono" fontSize="11">
              {t.label}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#area-${id})`} />
        <path d={line} fill="none" stroke="#c9a86a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Changes with a cause */}
        {points.map((p, i) =>
          p.cause ? (
            <circle key={i} cx={xy[i].x} cy={xy[i].y} r={hover === i ? 5 : 3.5} fill={(p.delta ?? -1) >= 0 ? '#4cc38a' : '#e5484d'} stroke="#19191b" strokeWidth="2" />
          ) : null
        )}

        {/* Now */}
        <circle cx={last.x} cy={last.y} r={4.5} fill="#c9a86a" stroke="#19191b" strokeWidth="2" />

        {hover !== null && <line x1={xy[hover].x} x2={xy[hover].x} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(237 237 237 / 0.18)" />}
      </svg>

      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-control bg-raised border border-line px-3 py-2 shadow-lift animate-fade whitespace-nowrap"
          style={{ left: `${Math.min(88, Math.max(12, (xy[hover].x / W) * 100))}%` }}
        >
          <span className="block font-mono text-meta text-fg-3">
            {hover === points.length - 1 ? 'Now' : new Date(hp.t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="block text-caption text-fg">
            Trust {hp.trust.toFixed(1)}
            {hp.delta !== undefined && hp.cause && (
              <span className={hp.delta >= 0 ? 'text-positive' : 'text-negative'}>
                {' '}
                {hp.delta >= 0 ? '+' : '−'}
                {Math.abs(hp.delta).toFixed(1)}
              </span>
            )}
          </span>
          {hp.cause && <span className="block text-meta text-fg-2">{hp.cause.charAt(0).toUpperCase() + hp.cause.slice(1)}</span>}
        </div>
      )}
    </div>
  );
};
