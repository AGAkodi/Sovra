# Dashboard screenshots

Captured from the live dashboard (https://sovra-near.vercel.app) against NEAR testnet, no wallet connected.
Regenerate with `node scripts/capture-screenshots.mjs docs/screenshots` (headless Edge; `SHOTS_URL=http://localhost:5173` for a local run).

The UI is being rebuilt screen by screen from [design.md](../../design.md). Screens marked *legacy* still use the old layout and wording inside the new palette.

| File | Screen | State |
|---|---|---|
| `01-home.png` | Home: allowance dial, available balance, trust / level / last risk, waiting banner, recent payments | Rebuilt |
| `02-agent.png` | Agent | Legacy |
| `03-payments.png` | Payments: filters with counts, search, plain-language outcomes | Rebuilt |
| `04-evidence-drawer.png` | Payment drawer: an owner-approved 2.5 NEAR payment, why it waited, risk check, the agent's words, proof | Rebuilt |
| `05-approvals.png` | Approvals: a 2.5 NEAR payment held at level 5 as a slip with the countdown ring, plus recent decisions | Rebuilt |
| `06-limits.png` | Limits (policy v2) | Legacy |
| `07-activity.png` | Activity: one sentence per event, grouped by day, with proof links | Rebuilt |
| `08-mobile-home.png` | Home at 390 px | Rebuilt |
| `09-mobile-payments.png` | Payments at 390 px | Rebuilt |
| `10-mobile-approvals.png` | Approvals at 390 px | Rebuilt |
| `11-mobile-activity.png` | Activity at 390 px | Rebuilt |
