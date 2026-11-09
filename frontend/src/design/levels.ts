/** The six authority levels, named once (docs/DESIGN.md section 2). */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export type Ink = 'positive' | 'neutral' | 'brass' | 'negative';

export interface LevelInfo {
  level: Level;
  name: string;
  /** One plain sentence: what the agent may do at this level. */
  means: string;
  ink: Ink;
}

export const LEVELS: Record<Level, LevelInfo> = {
  1: { level: 1, name: 'Free to pay', means: 'Pays routine invoices on its own', ink: 'positive' },
  2: { level: 2, name: 'Watched', means: 'Pays on its own, every payment logged for you', ink: 'positive' },
  3: { level: 3, name: 'Slowed', means: 'Still pays, while it rebuilds trust after something unusual', ink: 'neutral' },
  4: { level: 4, name: 'Watched closely', means: 'Still pays, flagged because trust is low or the risk is elevated', ink: 'neutral' },
  5: { level: 5, name: 'Needs you', means: 'The vault holds the money until you approve or decline', ink: 'brass' },
  6: { level: 6, name: 'Blocked', means: 'Refused by the vault; nothing leaves', ink: 'negative' },
};

export function levelInfo(level: number | undefined): LevelInfo {
  const l = Math.min(6, Math.max(1, Math.round(level ?? 1))) as Level;
  return LEVELS[l];
}

/** Tailwind classes for each ink, so components never pick colors ad hoc. */
export const INK_TEXT: Record<Ink, string> = {
  positive: 'text-positive',
  neutral: 'text-fg-2',
  brass: 'text-brass',
  negative: 'text-negative',
};

export const INK_BG: Record<Ink, string> = {
  positive: 'bg-positive',
  neutral: 'bg-fg-2',
  brass: 'bg-brass',
  negative: 'bg-negative',
};
