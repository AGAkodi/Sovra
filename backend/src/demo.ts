/**
 * Demo amount scaling. Faucet-funded testnet accounts hold only a few NEAR, so the
 * reference scenario (3 / 25 / 80 NEAR, 30 NEAR cap, 100 NEAR daily budget) is
 * multiplied by DEMO_SCALE. Ratios are unchanged, so risk scores and authority
 * levels are the same at any scale.
 *
 *   DEMO_SCALE=1    -> 3 / 25 / 80 NEAR   (default; simulation and tests)
 *   DEMO_SCALE=0.1  -> 0.3 / 2.5 / 8 NEAR (suggested for faucet accounts)
 */
export const REFERENCE = {
  routineNear: 3,
  spikeNear: 25,
  injectionNear: 80,
  perTxCapNear: 30,
  dailyBudgetNear: 100,
  baselineNear: 3,
} as const;

export function getDemoScale(): number {
  const raw = process.env.DEMO_SCALE;
  if (!raw) return 1;
  const scale = Number(raw);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
    throw new Error(`DEMO_SCALE must be a number in (0, 1], got '${raw}'`);
  }
  return scale;
}

/** Rounds to 6 decimals to keep yoctoNEAR conversion exact. */
export function scaled(near: number): number {
  return Math.round(near * getDemoScale() * 1e6) / 1e6;
}
