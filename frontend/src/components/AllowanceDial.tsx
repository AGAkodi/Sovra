import React, { useId } from 'react';
import { near } from '../design/format';

/**
 * The allowance dial (docs/DESIGN.md moment 1): a 240° brass gauge of today's spending
 * against the daily limit, with a needle, fine ticks and a mark at the per-payment limit.
 */
const CX = 160;
const CY = 156;
const R = 120;
const START = 150; // degrees, SVG coordinates (0 = right, clockwise)
const SWEEP = 240;

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function arcPath(radius: number) {
  const s = point(START, radius);
  const e = point(START + SWEEP, radius);
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 1 1 ${e.x} ${e.y}`;
}

export const AllowanceDial: React.FC<{
  spent: number;
  limit: number;
  perPayment?: number;
  frozen?: boolean;
}> = ({ spent, limit, perPayment, frozen }) => {
  const id = useId().replace(/:/g, '');
  const safeLimit = limit > 0 ? limit : 1;
  const fraction = Math.min(1, Math.max(0, spent / safeLimit));
  const left = Math.max(0, limit - spent);
  const needleAngle = START + SWEEP * fraction;
  const capFraction = perPayment && limit > 0 ? Math.min(1, perPayment / limit) : null;
  const ticks = Array.from({ length: 49 }, (_, i) => i);

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      <svg viewBox="0 0 320 236" className="w-full h-auto block" role="img" aria-label={`${near(spent)} of ${near(limit)} NEAR spent today, ${near(left)} left`}>
        <defs>
          <linearGradient id={`brass-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#8a6a2f" />
            <stop offset="55%" stopColor="#c9a86a" />
            <stop offset="100%" stopColor="#e3cc9c" />
          </linearGradient>
          <radialGradient id={`face-${id}`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#1f1f21" />
            <stop offset="100%" stopColor="#19191b" />
          </radialGradient>
          <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="72%" stopColor="#fff" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`face-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="236">
            <rect x="0" y="0" width="320" height="236" fill={`url(#fade-${id})`} />
          </mask>
          <radialGradient id={`hub-${id}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#e3cc9c" />
            <stop offset="100%" stopColor="#8a6a2f" />
          </radialGradient>
        </defs>

        {/* Dial face: a barely lighter disc so the gauge reads as an object */}
        <g mask={`url(#face-mask-${id})`}>
          <circle cx={CX} cy={CY} r={R + 26} fill={`url(#face-${id})`} />
          <circle cx={CX} cy={CY} r={R + 26} fill="none" stroke="rgb(237 237 237 / 0.06)" />
        </g>

        {/* Fine engraved ticks; every sixth one longer */}
        {ticks.map((i) => {
          const angle = START + (SWEEP * i) / (ticks.length - 1);
          const major = i % 6 === 0;
          const a = point(angle, R + 14);
          const b = point(angle, R + (major ? 22 : 18));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={major ? 'rgb(237 237 237 / 0.32)' : 'rgb(237 237 237 / 0.14)'}
              strokeWidth={major ? 1.25 : 1}
            />
          );
        })}

        {/* Track and spent arc */}
        <path d={arcPath(R)} fill="none" stroke="rgb(237 237 237 / 0.08)" strokeWidth={12} strokeLinecap="round" />
        <path
          d={arcPath(R)}
          fill="none"
          stroke={frozen ? '#8b95a1' : `url(#brass-${id})`}
          strokeWidth={12}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${Math.max(fraction, 0.0001)} 1`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />

        {/* Per-payment limit mark */}
        {capFraction !== null && (() => {
          const angle = START + SWEEP * capFraction;
          const a = point(angle, R - 12);
          const b = point(angle, R + 10);
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ededed" strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />;
        })()}

        {/* Needle and hub */}
        <g
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <line x1={CX - 14} y1={CY} x2={CX + R - 22} y2={CY} stroke={frozen ? '#8b95a1' : '#ededed'} strokeWidth={2} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={9} fill={frozen ? '#8b95a1' : `url(#hub-${id})`} />
        <circle cx={CX} cy={CY} r={9} fill="none" stroke="rgb(0 0 0 / 0.35)" />
        <circle cx={CX} cy={CY} r={3} fill="#141415" />
      </svg>

      {/* Readout under the hub, between the arc's ends */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
        <span className="font-mono text-figure font-medium text-fg">{near(left)}</span>
        <span className="text-meta text-fg-3">{frozen ? 'NEAR left, spending frozen' : 'NEAR left today'}</span>
      </div>
    </div>
  );
};
