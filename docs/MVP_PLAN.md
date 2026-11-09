# Throttle for NEAR: MVP Implementation Plan

Written 2026-11-08. Deadline 2026-11-14 23:59 UTC (about 6.5 days).

> **Progress (2026-11-09):** Days 1–6 done except the demo video. Everything runs on testnet and is hosted (https://sovra-near.vercel.app). Risk engine v2 matches RISK_MODEL.md; the security report is backed by live tx hashes; README rewritten; clean clone verified. Remaining: record the demo video and highlight, then submit.
>
> **Earlier progress (2026-11-08, end of day):** Days 1–3 done. All six acceptance demo steps verified on testnet; owner approve and freeze work from the dashboard via Meteor Wallet (MyNearWallet is retired). RPC moved to FastNEAR after `rpc.testnet.near.org` started returning 429. Not yet done: dashboard deposit tested end to end, persistence (Day 4), Vercel deploy, Groq agent, UI pass, video. See `IMPLEMENTATION_LOG.md` for tx evidence.

The goal is the TODO's **six-step acceptance demo, running on real testnet transactions**. Anything that doesn't serve that demo waits until it works end to end.

---

## 1. Where we are against TODO.md

Legend: ✅ done · 🟡 partly done / written but not verified · ❌ not started

| TODO section | Status | Notes |
|---|---|---|
| **0. Acceptance demo (6 steps)** | ❌ 0/6 on-chain | All six steps run only in simulation mode. The contract is not deployed and there is no owner wallet. |
| 1. Rules / implementation log | 🟡 | `IMPLEMENTATION_LOG.md` covers Phases 0–1. There is no lint setup and no CI. |
| 2. Research | 🟡 | `docs/RESEARCH.md` exists, but versions are stale (installed: near-sdk 5.30.1, near-api-js 5.1.1). |
| 3. Scaffold | 🟡 | The monorepo, lockfiles and git remote (`AGAkodi/Sovra`) exist. `agent/` is an empty folder; the agent lives in the backend. There's no CI, no linting and no testnet accounts yet. The Supabase migration exists but isn't used. |
| **4. Vault contract** | 🟡 | State, owner methods, signed `request_payment`, replay/expiry/policy-version/network checks, reserve-then-callback, events and view methods are all done. **Missing:** a way to release funds reserved by expired held requests, owner withdrawal, `get_agent_status`, limits on stored data, and deployment. 21 unit tests are written but **haven't run** (no C toolchain on this PC). |
| 5. Risk engine | 🟡 | Five weighted factors, decaying trust and six authority levels work, with 10 tests. It drifts from `RISK_MODEL.md`: the low-history penalty isn't applied, there's no hysteresis, trust rises on evaluation instead of on confirmed payment, there's no protection against an attacker skewing the baseline, and `baseline_median` in the snapshot is hardcoded. |
| 6. Agent integration | 🟡 | The agent loop runs: propose → evaluate → sign → submit → reconcile (fixed today). It uses scripted scenarios only, with no LLM. A restricted function-call key is documented in `scripts/deploy.ts` but not created. |
| 7. Backend / approvals | 🟡 | Most endpoints exist, plus a reconciler and fail-closed behaviour. Data is in memory and lost on restart. There's no owner sign-in and no rate limits. |
| **8. UI (6 screens)** | 🟡 | All screens exist. The wallet button is decorative, nothing has been shown with real chain data, the sidebar doesn't collapse on mobile, and there are no screenshots. Audit JSON export exists. |
| 9. Security test plan | 🟡 | Covered by contract unit tests (not run) and backend mocked-RPC tests. There's no evidence from testnet. |
| 10. Release | ❌ | Nothing is hosted, there's no video, and the README's feature matrix and links are missing. |

**Main gap:** the safety logic is now consistent between contract and backend. What's missing is everything that turns it into a demo: **a deployed vault, an owner wallet, and real tx hashes in the UI.**

---

## 2. Key decisions (recommended approach)

1. **Owner authority stays entirely on-chain, signed in the owner's wallet.** Approve, reject, freeze, unfreeze, set_policy and deposit are wallet transactions from the frontend via `@near-wallet-selector`. The backend never holds an owner key (it already returns 409 for these in testnet mode).
   - *This makes the TODO's "wallet signature challenge" for the backend unnecessary for the MVP.* The backend can't authorize money movement at all, so there's nothing to log into. Document this in SECURITY.md instead of building challenge-based login.
   - **Fallback** if wallet-selector fights us for more than half a day: owner actions run through near-cli-rs on camera, and the UI shows the resulting state. That's weaker, but honest.
2. **The chain is the source of truth for request status.** The backend keeps only what the chain doesn't have: risk evaluations, task evidence and the audit log. Persist those in **Supabase** (the migration already exists) so restarts and hosting don't wipe the demo. If short on time: a JSON file, plus rebuilding request rows from `get_recent_requests` at startup.
3. **Run contract tests in GitHub Actions (Ubuntu),** not on this Windows PC. That avoids installing VS Build Tools, satisfies the TODO's CI item, and gives judges a green badge. (Alternative: `rustup` + `build-essential` inside the existing WSL Ubuntu.)
4. **Scripted scenarios first; LLM agent on Groq second.** The TODO allows scripted mode if it's clearly labelled. The LLM only interprets the task and proposes recipient and amount. Its output is checked against a schema (zod); it never authorizes anything. If Groq is unavailable, the agent falls back to scripted mode and labels it. Groq's API is OpenAI-compatible; confirm the model ID and JSON-mode support against Groq's docs at implementation time.
5. **Hosting: everything on Vercel** (decided 2026-11-08). The frontend is a static Vite build. The Express backend runs as a Vercel serverless function. That has consequences:
   - **No in-memory state and no `setInterval`.** Serverless instances don't persist between requests, so persistence must be external: **Supabase** (or Neon via the Vercel Marketplace). This moves Supabase from "nice to have" to **required**.
   - Reconciliation runs on each read (re-check open requests when the list or a request is fetched) plus a **Vercel Cron** job hitting a `/cron/reconcile` endpoint.
   - The agent key, signer key and Groq key go in Vercel environment variables (server-side only, never `VITE_`-prefixed).
   - A testnet `request_payment` call takes a few seconds; stay within the function timeout, and set `maxDuration` if needed.

**Decisions so far (2026-11-08):** no testnet accounts yet (create them on Day 2 with near-cli-rs; the commands must be run by you because they sign with your keys); pushing to `AGAkodi/Sovra` is approved; Vercel for hosting; Groq for the LLM agent.

---

## 3. Day-by-day plan

Each day ends with a piece of evidence. If the evidence isn't there, the next day's first job is to get it.

### Day 1: Sun Nov 8 (rest of today): make it verifiable
- [ ] Commit the chain-path fixes on a branch, push, and open a PR.
- [ ] Add a GitHub Actions workflow: `cargo test` + wasm build for the contract, `npm test` + `tsc` for the backend, `vite build` for the frontend.
- [ ] Fix whatever the first CI run of the 21 contract tests turns up.
- **Evidence:** green CI run link.

### Day 2: Mon Nov 9: vault live on testnet, agent paying through it
- [ ] Create the testnet accounts (owner, vault, agent, recipient, attacker) and fund them from the faucet.
- [ ] Contract additions, in the same deploy:
  - `expire_request(request_id)`: anyone can call it after the approval window to release the reserved funds.
  - `withdraw(amount)`: owner only, cannot touch reserved funds.
  - `get_agent_status`.
  - A cap on `recent_events` (keep the last N).
- [ ] `npm --prefix backend run keygen` → deploy with `scripts/deploy.ts` → set the agent, whitelist the recipient, fund, add the restricted agent key.
- [ ] Run routine, spike and injection through `/scenarios/run` in testnet mode. Confirm each on nearblocks.
- **Evidence:** three tx hashes (executed, held, rejected on-chain) recorded in `IMPLEMENTATION_LOG.md`.

### Day 3: Tue Nov 10: owner wallet (the critical path)
- [ ] Add `@near-wallet-selector/core` + `modal-ui` + one or two wallets (MyNearWallet, Meteor) to the frontend. Replace the decorative Topbar wallet button with a real connect button that shows the account ID.
- [ ] Owner actions as wallet transactions: deposit, approve_request, reject_request, freeze, unfreeze. After each one, call `POST /payment-requests/:id/sync` (or a vault refresh) and show *pending wallet → submitted → confirmed / failed*. Never update the UI optimistically.
- [ ] Approval Center: second confirmation for high-value requests, bound recipient and amount, live expiry countdown, controls disabled once expired or resolved.
- [ ] Show an "Expire" action (calls `expire_request`) for lapsed holds.
- **Evidence:** a real approve tx and a real freeze tx, then an agent request refused with "Vault is frozen". **At this point all six demo steps work on testnet.**

### Day 4: Wed Nov 11: persistence, Vercel readiness, risk-model alignment
- [ ] Backend store → Supabase (`payment_requests`, `risk_evaluations`, `audit_events`, `trust_events`). Rebuild request statuses from the chain on read. **Required for Vercel**, not optional.
- [ ] Make the Express app run as a Vercel function (`api/index.ts` exporting `app`), add reconcile-on-read, and add a `/cron/reconcile` endpoint with a Vercel Cron schedule. Deploy a preview to Vercel early to catch timeout or bundling problems.
- [ ] Bring the risk engine in line with `RISK_MODEL.md`, or update the doc where the code is the better choice:
  - Apply the low-history +20 penalty.
  - Trust +2 only on a confirmed `Succeeded` (at most +10 per 24 h); −15 on owner rejection; no penalty for RPC errors.
  - Hysteresis: move up a level only after N clean payments or a cooldown period.
  - Baseline built only from successful payments, with a minimum sample size, so rejected or attacker proposals can't shift it.
  - Real `baseline_median` in the snapshot; store policy version and engine version with each evaluation.
- [ ] Tests for boundaries, decay, recovery and baseline poisoning.
- **Evidence:** a backend restart keeps the history; new risk tests pass in CI.

### Day 5: Thu Nov 12: UI against §8, with real data
- [ ] Overview: KPIs from the chain (balance, trust, authority, payments today, risk), authority timeline, real "Recent Decisions" rows.
- [ ] Payments: filter chips; "Rejected by risk engine" vs "Rejected on-chain" vs "Refused by vault" (from `decided_by`).
- [ ] Policy Studio: current on-chain policy vN vs draft, a diff, then sign `set_policy` in the wallet. Only show controls the contract actually enforces as "on-chain"; label the rest "off-chain risk engine".
- [ ] Audit Trail: proof links only for real tx hashes; "Unverified" for missing receipts; JSON export.
- [ ] Quality gates: loading, empty, RPC-stale and wallet-rejected states; truncated account IDs with copy; UTC times; sidebar that collapses on mobile; focus states.
- [ ] LLM task interpreter on **Groq** (zod-checked output, scripted fallback, mode label in Scenario Lab, `GROQ_API_KEY` server-side only). The injection scenario must still be stopped by the risk engine and the vault even when the LLM follows the injected instruction.
- **Evidence:** screenshots of all six screens in `docs/screenshots/`.

### Day 6: Fri Nov 13: ship and record
- [ ] Production deploy on Vercel (frontend + backend function + cron); check that no secrets reach the browser bundle.
- [ ] Clean-clone test following the README only.
- [ ] Rewrite `docs/SECURITY_TESTS.md` with real tx hashes for every row, or mark rows "not verified".
- [ ] README: architecture diagram, threat model, working-vs-planned feature table, setup, env reference, deployed URLs, contract ID, explorer links, demo steps.
- [ ] Record the 3–5 min demo and the 60–90 s highlight video.
- **Evidence:** live URL, public repo, video files.

### Day 7: Sat Nov 14: buffer and submit by 23:59 UTC
- [ ] Re-run the full demo on the hosted app, fix anything that breaks, write the submission and the completion report (TODO §13).

---

## 4. Cut list (in this order, if a day slips)

1. LLM task interpreter: keep scripted mode, clearly labelled.
2. Policy Studio signing `set_policy` from the wallet: show the on-chain policy read-only, and change it with near-cli-rs on camera.
3. Supabase: use a JSON file plus rebuilding statuses from the chain.
4. Agent Monitor depth and mobile polish: fold into Overview, following the TODO §12 fallback.
5. Hysteresis: keep the documented thresholds, and say so in the risk model doc.

**Never cut:** real testnet transactions, the owner wallet approve/freeze, on-chain refusal of the injection attempt, and honest labelling of anything simulated.

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| wallet-selector setup or compatibility problems | Time-box to half a day; fall back to near-cli-rs for owner actions. |
| Not enough testnet NEAR from the faucet | Scale the scenarios down (e.g. 0.3 / 2.5 / 8 NEAR with a cap of 3); the ratios are what matter. |
| Agent key allowance runs out | Create the key with a 1 NEAR allowance (about 150 requests at 60 TGas). |
| Public RPC rate limits or outages | Configurable `NEAR_RPC_URL` (FastNEAR / Lava); the backend already fails closed and shows stale state. |
| Contract tests fail in CI | Day 1 is reserved for exactly this. |
| Hosted backend loses the signer key | Keys only in host env vars; checked at startup in testnet mode. |

---

## 6. Inputs needed from you

1. **Day 2:** install near-cli-rs and run the account-creation and deploy commands (I'll prepare them). Accounts are created with your keychain, so you run them.
2. **Day 4:** a Supabase project (URL + service key, for the backend env only) and a Vercel project linked to the repo.
3. **Day 5:** a Groq API key in the backend env.
