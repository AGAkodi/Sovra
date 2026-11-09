# Dashboard screenshots

Captured from the live dashboard (https://sovra-near.vercel.app) against NEAR testnet on 2026-11-09, no wallet connected.
Regenerate with `node scripts/capture-screenshots.mjs docs/screenshots` (headless Edge).

| File | Screen | What it shows |
|---|---|---|
| `01-overview.png` | Overview | Vault balance, trust, authority level, daily budget (policy v2: 15 NEAR), recent decisions, demo scenario buttons |
| `02-agent-monitor.png` | Agent Monitor | Trust score, six-level authority rail, behavioural baseline, LLM scenario lab (Groq gpt-oss-20b) |
| `03-payment-requests.png` | Payment Requests | Ledger with who decided each outcome: Confirmed onchain, Owner approved · paid, Rejected onchain, Refused by vault |
| `04-evidence-drawer.png` | Evidence drawer | The owner-approved 2.5 NEAR spike: risk factors, LLM proposal and reasoning, task evidence |
| `05-approvals.png` | Approvals | Empty state (no request currently held) |
| `06-policy-studio.png` | Policy Studio | On-chain policy v2, wallet-signed update control, demo impact panel |
| `07-audit-trail.png` | Audit Trail | Append-only events with testnet receipts; reconciler entries read from the vault contract |
| `08-mobile-overview.png` | Overview (phone) | 390 px layout with menu button |
| `09-mobile-payments.png` | Payments (phone) | Card layout with amount and status visible |
