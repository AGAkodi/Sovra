import React from 'react';
import { levelInfo, INK_BG, LEVELS, Level } from '../design/levels';

/**
 * The authority notch (docs/DESIGN.md signature): six ticks rising like a lever.
 * Ticks up to the agent's level are filled in that level's ink.
 */
export const Notch: React.FC<{ level: number; size?: 's' | 'm' | 'l'; frozen?: boolean; className?: string }> = ({
  level,
  size = 'm',
  frozen,
  className = '',
}) => {
  const info = levelInfo(level);
  const dims = { s: { w: 3, h: 8, gap: 2, rise: 1 }, m: { w: 4, h: 12, gap: 2, rise: 1.5 }, l: { w: 8, h: 24, gap: 4, rise: 3 } }[size];
  const fill = frozen ? 'bg-frozen' : INK_BG[info.ink];
  return (
    <span
      className={`inline-flex items-end ${className}`}
      style={{ gap: dims.gap }}
      role="img"
      aria-label={`Level ${info.level} of 6, ${info.name}`}
    >
      {([1, 2, 3, 4, 5, 6] as Level[]).map((l) => (
        <span
          key={l}
          className={`rounded-[1px] ${l <= info.level ? fill : 'bg-line-strong'}`}
          style={{ width: dims.w, height: dims.h - (6 - l) * dims.rise }}
        />
      ))}
    </span>
  );
};

/** Level 1-6 with names under each tick, for the Agent screen. */
export const NotchScale: React.FC<{ level: number }> = ({ level }) => {
  const current = levelInfo(level).level;
  return (
    <ol className="grid grid-cols-6 gap-2">
      {([1, 2, 3, 4, 5, 6] as Level[]).map((l) => {
        const info = LEVELS[l];
        const active = l === current;
        return (
          <li key={l} className={`rounded-control p-3 border ${active ? 'bg-raised border-line-strong shadow-row-active' : 'border-transparent'}`}>
            <span className={`block font-mono text-meta ${active ? 'text-fg' : 'text-fg-3'}`}>Level {l}</span>
            <span className={`block text-caption ${active ? 'text-fg' : 'text-fg-2'}`}>{info.name}</span>
          </li>
        );
      })}
    </ol>
  );
};
