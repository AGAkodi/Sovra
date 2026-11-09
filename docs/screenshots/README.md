# Dashboard screenshots

Captured from the live site (landing page https://sovra-near.vercel.app, dashboard /app) against NEAR testnet, no wallet connected, after the UI rebuild described in [DESIGN.md](../DESIGN.md).
Regenerate with `node scripts/capture-screenshots.mjs docs/screenshots` (headless Edge; `SHOTS_URL=http://localhost:5173` for a local run).

| File | Screen |
|---|---|
| `00-landing.png`, `00-mobile-landing.png` | Landing page, full length: hero with the dial and a held payment, live testnet counts, the problem, how it works, levels, controls, attack proof, FAQ |
| `01-home.png` | Home: allowance dial, available balance, trust / level / last risk, recent payments, scenarios |
| `02-agent.png` | Agent: trust over 7 days with the cause of each change, how trust moves, the six levels, baseline facts |
| `03-payments.png` | Payments: filters with counts, search, plain-language outcomes |
| `04-evidence-drawer.png` | Payment drawer: an owner-approved 2.5 NEAR payment, why it waited, risk check, the agent's words, proof |
| `05-approvals.png` | Approvals: a 2.5 NEAR payment held at level 5 as a slip with the countdown ring, plus recent decisions |
| `06-limits.png` | Limits (version 2): plain-language fields, approved recipients, and what changes for each demo invoice |
| `07-activity.png` | Activity: one sentence per event, grouped by day, with proof links |
| `14-settings.png` | Settings: wallet and vault, who holds which key, agent, connections |
| `08-mobile-home.png` … `13-mobile-limits.png` | The same screens at 390 px |
