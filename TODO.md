# Throttle for NEAR - MVP Build Checklist

> Agent execution brief. Target: demoable, testnet-only MVP for NEAR Hackathon 2026. Primary track: AI Security & Defense. Secondary: Agent Economy only if agent-to-agent payments are actually implemented. Deadline: **14 Nov 2026, 23:59 UTC**. Do not claim features are working until verified by tests and testnet receipts.

## 0. Mission and definition of done

Build an adaptive spending-control system for an autonomous task-paying AI agent. An agent proposes a NEAR payment, Throttle scores risk and behavioral drift, updates a decaying trust score, assigns one of six authority levels, and a NEAR Rust vault independently enforces the permitted transaction. Owner can approve a specific held payment or freeze the agent. Demonstrate real successful and blocked testnet transactions, not only simulated UI states.

**Non-negotiable acceptance demo:** (1) owner connects wallet and funds vault with testnet NEAR, (2) agent proposes ordinary 3 NEAR task payment and contract executes it, (3) agent proposes anomalous 25 NEAR payment and contract holds it for authenticated owner approval, (4) malicious instruction attempts 80 NEAR to unknown recipient and contract refuses, (5) owner freezes agent and another request fails, (6) dashboard shows actual tx hashes, policy versions, reason codes and statuses. Use small testnet balances and amounts if faucet availability is limited. Risk scores are illustrative until calibrated.

## 1. Rules for the coding agent

- [ ] Read this entire TODO.md before changing code; work in dependency order. Maintain checkboxes only after tests prove completion.
- [ ] Create `IMPLEMENTATION_LOG.md` with timestamp, commit, decisions, tests, blockers, and evidence links for every phase.
- [ ] Use TypeScript strict mode, Rust with near-sdk, and pinned compatible package versions. Verify current APIs in linked docs before coding; never guess SDK methods.
- [ ] Keep testnet only. No mainnet private keys, seed phrases, or real funds. Do not expose service keys in browser or logs.
- [ ] Implement the smallest working vertical slice before building advanced UI. Never mock a chain result as successful.
- [ ] Prefer explicit deterministic policy rules for financial authorization. LLM outputs may propose payments but must not authorize them.
- [ ] If an external dependency is blocked, document the issue and provide a local test alternative without pretending the integration works.
- [ ] Run lint, typecheck, contract unit tests, integration tests and end-to-end tests before marking release ready.

## 2. Official references and implementation research

- [ ] Read hackathon rules, track descriptions and submission instructions: https://nearhackathon.com/ and https://nearhackathon.com/HACKATHON.md
- [ ] Read NEAR docs and contract quickstart: https://docs.near.org/ and https://docs.near.org/smart-contracts/quickstart
- [ ] Check near-sdk-rs examples and current crate version: https://github.com/near/near-sdk-rs and https://docs.rs/near-sdk/latest/near_sdk/
- [ ] Read NEAR account/access-key model: https://docs.near.org/protocol/access-keys
- [ ] Read NEAR transactions and asynchronous receipts: https://docs.near.org/protocol/transaction-execution
- [ ] Read cross-contract execution and callbacks: https://docs.near.org/smart-contracts/anatomy/crosscontract
- [ ] Read smart contract security guidance: https://docs.near.org/smart-contracts/security/welcome
- [ ] Review NEAR JavaScript tooling: https://github.com/near/near-api-js
- [ ] Review wallet connection tooling: https://github.com/near/wallet-selector
- [ ] Review sandbox/integration testing: https://github.com/near/near-workspaces-rs and https://github.com/near/workspaces-js
- [ ] Review NEAR CLI for account creation/deployment: https://github.com/near/near-cli-rs
- [ ] Review NEAR Builders developer support: https://nearbuilders.org/build
- [ ] Record verified SDK versions, tested commands and any moved documentation URLs in `docs/RESEARCH.md`.

## 3. Project scaffold and environment [P0]

- [ ] Create monorepo: `contracts/throttle-vault`, `agent`, `backend`, `frontend`, `supabase/migrations`, `scripts`, `docs`, `tests/e2e`.
- [ ] Add root `README.md`, `TODO.md`, `IMPLEMENTATION_LOG.md`, `.env.example`, `.gitignore`, `LICENSE`, `SECURITY.md`.
- [ ] Setup React + Vite + TypeScript + Tailwind frontend; Node.js TypeScript backend; Rust toolchain with WASM target; near-cli-rs.
- [ ] Setup formatting, linting, typecheck, CI workflow and package lockfiles.
- [ ] Create separate NEAR testnet identities for owner, agent function-call key, recipient, and attacker. Document safe setup without committing credentials.
- [ ] Provision Supabase project or local Postgres, and migrations. Never place privileged service-role key in frontend.
- [ ] Verify RPC connectivity, wallet connection, testnet deployment and transaction lookup.
- [ ] Create env vars for `NEAR_NETWORK`, `NEAR_RPC_URL`, `VAULT_CONTRACT_ID`, `OWNER_ACCOUNT_ID`, `AGENT_ACCOUNT_ID`, `DATABASE_URL`, backend signing configuration and frontend public URL. No hardcoded secrets.

## 4. Vault contract [P0, build first]

**Contract role:** Hold testnet NEAR, enforce policy independently, expose auditable status. Agent has only restricted function-call access to vault request method. Owner controls upgrades and permissions. Do not give agent a full-access treasury key.

- [ ] Define state: owner, approved agent keys/accounts, freeze flag, policy version, allowed recipients, per-tx cap, daily budget, spent/reserved amounts, request nonce/id, request state, pending approvals, request expiration.
- [ ] Implement owner-only `set_policy`, `set_agent`, `set_recipient`, `freeze`, `unfreeze`, and `approve_request` / `reject_request` with exact request IDs and expiry.
- [ ] Implement `request_payment(recipient, amount, request_id, expiry, policy_version, risk_attestation)` with strict caller/key checks, unique IDs, recipient validation, hard caps, sufficient available balance and frozen-state check.
- [ ] Define **attestation trust model**: an owner-authorized policy signer may sign a decision binding vault ID, chain/network, request ID, recipient, amount, risk band, authority level, policy version and expiry. Verify signature onchain or use an owner-authorized contract account to submit decisions. Do not trust arbitrary backend-provided risk scores. Document chosen design and tests.
- [ ] Prevent stale, duplicate, replayed, cross-vault and cross-network attestations. Never allow a risk attestation to exceed immutable owner-configured hard caps.
- [ ] Make authority enforcement explicit: full/logged/monitored/restricted/approval-required/frozen, each with exact contract-enforceable rules. If six levels share a contract behavior, document the distinction and how it is audited.
- [ ] Implement owner approval as one-time, amount/recipient-bound, expiring authorization. Agent cannot approve its own request.
- [ ] For async native NEAR transfer, reserve funds before Promise, record `executing`, use private callback to finalize `succeeded` or `failed`, and restore reservation on failure. Confirm callback origin and gas/deposit requirements against current SDK docs.
- [ ] Handle attached deposit correctly, including funding via payable method if used. Protect against draining contract storage reserve or creating unbounded state.
- [ ] Ensure `request_payment` can never bypass approval via direct transfer or altered arguments. Owner recovery/withdrawal should be separate and documented.
- [ ] Expose view methods `get_policy`, `get_agent_status`, `get_request`, `get_vault_balance`, `get_recent_events` or indexed event equivalents.
- [ ] Emit structured versioned events with request ID, policy version, decision and tx/receipt reference; never emit secrets.
- [ ] Write unit and sandbox tests for success, insufficient funds, unknown recipient, cap exceedance, daily budget, frozen mode, unauthorized caller, replay, expired approval, stale policy, malicious attestation, concurrent requests and failed transfer callback.
- [ ] Deploy to testnet and save contract ID, deployment tx hash, verified interface and reproducible deployment script.

## 5. Risk engine and dynamic authority [P0]

- [ ] Define canonical `PaymentProposal` schema: agent ID, task ID, recipient, token (`NEAR` only), amount in yoctoNEAR, timestamp, request ID, task evidence, policy version.
- [ ] Implement deterministic risk components: amount vs rolling baseline, transaction velocity, unknown recipient, recent failure rate, task evidence validity, and policy violations. Specify weights, thresholds, missing-data behavior and reason codes in `docs/RISK_MODEL.md`.
- [ ] Use bounded 0-100 risk score, with conservative behavior for unknown or insufficient history. Distinguish model confidence from risk score.
- [ ] Implement baseline drift from historical successful and attempted payments, using time windows and minimum sample count. Prevent attacker-controlled proposals from instantly poisoning baseline.
- [ ] Implement trust score (0-100) with time-based decay toward a conservative neutral value, penalties for violations, and carefully limited recovery from verified good outcomes. Failed RPC calls must not automatically count as malicious actions.
- [ ] Define six authority levels and thresholds, including hysteresis/cooldown to avoid flapping. Document how score, drift, hard rules and owner overrides combine.
- [ ] Implement strict policy ordering: owner freeze/hard caps > authenticated approval requirements > risk recommendations > agent requests. A high trust score never bypasses hard limits.
- [ ] Store each evaluation's feature snapshot, scores, reasons, baseline version, authority before/after and model version for replayability.
- [ ] Add deterministic tests for normal payment, velocity spike, new recipient, huge payment, low-data agent, trust decay, recovery, freeze, boundary thresholds, and drift poisoning.
- [ ] Expose a typed risk evaluation API and reproducible scenario fixtures.

## 6. Real autonomous agent integration [P0]

- [ ] Implement a narrow task-paying agent with realistic jobs (e.g. approved microtask completions), not a button that directly calls the vault.
- [ ] Define agent loop: receive task -> inspect completion evidence -> propose recipient/amount -> request Throttle evaluation -> request vault execution or wait for owner -> reconcile outcome.
- [ ] Use an LLM only for task interpretation and payment proposal, with schema validation, bounded tool permissions and deterministic fallbacks. If AI API unavailable, support scripted scenario mode clearly labeled as simulation.
- [ ] Create three repeatable scenarios: routine task payment, abnormal high-value payment, and injected instruction attempting unauthorized recipient/payment.
- [ ] Restrict the agent's NEAR function-call key to only the vault and required methods. Check allowance and gas usage. Never share owner full-access credentials with the agent runtime.
- [ ] Reconcile chain receipts before marking a payment successful. Retry network reads safely without repeating transfers.
- [ ] Show agent reasoning summary, proposed action, Throttle decision, chain status and tx hash in UI.

## 7. Backend, persistence and approvals [P0]

- [ ] Database tables: `users`, `agents`, `vaults`, `policies`, `policy_versions`, `payment_requests`, `risk_evaluations`, `trust_events`, `approvals`, `chain_transactions`, `audit_events`, `demo_scenarios`.
- [ ] Add indexes/uniqueness for `(vault_id, request_id)`, chain tx hashes and approval IDs. Use explicit migration scripts and seed data.
- [ ] Add API endpoints: `GET /health`, `GET /agents`, `GET /agents/:id`, `GET /vaults/:id`, `POST /payment-requests`, `GET /payment-requests/:id`, `POST /approvals/:id/approve`, `POST /approvals/:id/reject`, `POST /agents/:id/freeze`, `POST /agents/:id/unfreeze`, `GET /events`.
- [ ] Authenticate owner with NEAR wallet signature challenge including nonce, domain, expiry and chain context. Store one-time nonces server-side and consume atomically; prevent replay. Validate wallet-selector integration against current docs.
- [ ] Require owner role for policy edits, approval, freeze/unfreeze; reject cross-owner access. Backend cannot forge owner authorization.
- [ ] Persist event log append-only where practical. Record pending, accepted, executing, succeeded, failed, rejected, expired distinctly.
- [ ] Use transaction idempotency, validation, rate limits and safe error messages. Handle partial RPC failures and database downtime.
- [ ] Add background reconciliation of pending chain receipts and expiration of approvals. Show last synced time and stale state in UI.
- [ ] Add structured logs with correlation/request IDs and health checks.

## 8. Throttle-specific UI/UX specification [P0]

**Design direction:** A serious security operations console for autonomous agent money movement, not a generic crypto trading dashboard. Desktop-first responsive layout. Near-black `#0B1018` background, raised slate panels `#121B27`, subtle borders `#273446`, cool cyan `#4CC9E8` for telemetry, restrained amber `#F2B544` for caution, red `#EF6464` for blocked/frozen, green `#38C98B` for confirmed onchain success. Use clean sans-serif typography (Inter or Geist), tabular numbers, 8px spacing system, generous negative space, rounded 12px cards. NEAR branding should be accurate and subtle. Never rely on color alone for status.

**Navigation:** persistent left sidebar with `Overview`, `Agent Monitor`, `Payment Requests`, `Approvals`, `Policies`, `Audit Trail`, `Settings`. Top bar: `THROTTLE / NEAR`, Testnet environment chip, live RPC/Indexer sync status, connected owner wallet, last update time. On mobile collapse sidebar into a menu; preserve actionable approvals.

### Screen 1: Overview / Command Center (`/overview`)
- [ ] Header `Agent Security Overview`, description `Adaptive authority for autonomous payments`, environment label `NEAR Testnet`.
- [ ] Top KPI row: Vault Balance (NEAR), Current Trust (0-100 with 7-day trend), Current Authority (one of six), Payments Today (successful/blocked), Risk Exposure (current risk score). No fake dollar values.
- [ ] Main left 2/3: `Authority Timeline` showing level changes over time with reason markers and selected event details. Overlay `Risk Score` trend or offer tabs.
- [ ] Main right 1/3: `Agent Status` with identity, connected key scope, last heartbeat, vault contract ID, freeze toggle with confirmation, and `Run Demo Scenario` action.
- [ ] Bottom: `Recent Decisions` table columns Time, Task, Recipient, Amount, Risk, Authority, Decision, Chain Status; row opens detailed evidence drawer.
- [ ] Empty states: `No agent activity yet. Run a scenario to see Throttle evaluate a payment.`; disconnected RPC clearly indicated.

### Screen 2: Agent Monitor (`/agent`)
- [ ] Prominent `Trust Score` radial or horizontal meter and `Authority Level` segmented six-step rail, showing current level and transition reason.
- [ ] `Behavior Baseline` panel: median normal payment, 24h volume, recent recipient set, payment frequency, sample size, confidence warning if sparse.
- [ ] `Risk Breakdown` stacked rows for amount anomaly, velocity, recipient novelty, policy violations and evidence quality with actual numerical contributions.
- [ ] `Agent Activity Feed` chronological steps: task received -> proposal created -> risk evaluated -> policy checked -> chain request -> receipt confirmed.
- [ ] `Scenario Lab` has three explicit buttons `Normal Payment`, `Spending Spike`, `Prompt Injection Attempt`; every click produces a new request ID and real evaluation. Label scripted vs LLM-driven mode.

### Screen 3: Payment Requests (`/payments`)
- [ ] Searchable table with filter chips `All`, `Pending`, `Needs Approval`, `Executing`, `Succeeded`, `Blocked`, `Failed`.
- [ ] Columns: Request ID, Agent, Recipient, Amount NEAR, Risk, Authority, Reason, Requested, Status. Clicking opens drawer with task evidence, risk feature values, attestation verification, policy version, explorer link and timeline.
- [ ] Use `Blocked by vault` only if onchain enforcement was actually exercised. Differentiate `Rejected by risk engine` from `Onchain rejected`.

### Screen 4: Approval Center (`/approvals`)
- [ ] `Requires Your Decision` queue with large request cards: amount, recipient full address/copy, task, risk reasons, expiry countdown, policy version, available vault balance.
- [ ] Approve/Reject buttons launch owner wallet-authenticated action and show pending wallet confirmation, submitted, final receipt or failure.
- [ ] Require second confirmation for anomalous high-value payments. Show explicit `You are authorizing only this request` and immutable bound recipient/amount.
- [ ] Expired or already resolved requests have disabled controls and clear status. No optimistic `Approved` success before chain confirmation.

### Screen 5: Policy Studio (`/policies`)
- [ ] Form groups: `Hard Guardrails` (per-payment cap, daily spend budget, allowed recipients), `Adaptive Risk` (thresholds, drift sensitivity, trust decay), `Approval Rules` (approval-required threshold, expiry), `Emergency Controls` (freeze/unfreeze).
- [ ] Preview side panel `How this policy affects an agent` with examples at risk 15/50/85 and six-level authority rail.
- [ ] Show `Current onchain policy vN` vs `Draft policy`, explicit unsaved state, diff before owner signs changes, and confirmed tx hash after update.
- [ ] No policy form should imply offchain controls are onchain enforced unless the contract supports them.

### Screen 6: Audit Trail (`/audit`)
- [ ] Chronological immutable-looking event feed with filters by agent, decision, request ID, authority transition and onchain status.
- [ ] Each event details `Who/what initiated`, `What was requested`, `Why Throttle decided`, `Which policy version`, `What the vault did`, `Proof` (testnet explorer link).
- [ ] Add `Export JSON` for judge verification; flag any missing receipts as `Unverified`, never `Success`.

### UI interaction quality gates
- [ ] Every visible button works or is clearly disabled with explanation; no decorative fake interactions.
- [ ] Loading, empty, failure, expired, stale-RPC and wallet-rejected states implemented for all transactional screens.
- [ ] Show account IDs in truncated form with copy/full tooltip, readable NEAR amounts, UTC timestamps with local-time tooltip, and actual tx links.
- [ ] Mobile responsive at 375px, tablet at 768px, desktop at 1440px; keyboard accessible, clear focus states, WCAG-conscious contrast.
- [ ] Screenshot each of the six screens and save under `docs/screenshots/`.

## 9. Security and adversarial test plan [P0]

- [ ] Unauthorized agent attempts direct native NEAR transfer from vault -> impossible without vault-controlled method.
- [ ] Agent calls vault with unknown recipient -> rejected.
- [ ] Agent tampers with amount/recipient after risk approval -> attestation mismatch and rejection.
- [ ] Replay same request ID or signature -> rejected.
- [ ] Agent submits old policy version or expired attestation -> rejected.
- [ ] Attacker submits forged risk signature -> rejected.
- [ ] Agent tries to approve own held payment -> rejected.
- [ ] Agent requests payment after freeze -> rejected.
- [ ] Concurrent requests try to exceed remaining daily budget -> no overspend.
- [ ] Async transfer fails -> correct final state, reserved balance restored, no double payment.
- [ ] Network disconnect, RPC timeout, stale UI, DB unavailable -> fail closed for authorizations and clearly show uncertainty.
- [ ] Prompt injection embedded in task description -> agent may propose bad payment, but deterministic policy/vault prevents transfer.
- [ ] Verify owner key compromise and backend compromise are out-of-scope or mitigated as explicitly documented; never claim absolute security.
- [ ] Produce `docs/SECURITY_TESTS.md` with commands, test outputs, actual tx hashes and known limitations.

## 10. Demo readiness and release [P0]

- [ ] Deploy contract to NEAR testnet, backend to hosted environment, frontend to Vercel, database with migrations.
- [ ] Ensure hosted backend securely stores agent function-call credentials and no frontend secret leakage.
- [ ] Seed one agent, one vault, three demo tasks, known safe recipient, and attacker recipient fixture. Use only testnet assets.
- [ ] Add a one-command local startup or clearly documented setup (`README.md`), plus reproducible contract deployment and seed scripts.
- [ ] Record 3-5 minute demo: product problem -> owner funds vault -> normal payment confirmed -> anomalous payment held -> owner approval -> prompt-injection attempt blocked -> freeze -> audit trail and explorer evidence.
- [ ] Record a separate 60-90 second highlight for X. Tag `@NEARProtocol` and `#NEARHackathon`, and say it was built for NEAR HACKATHON.
- [ ] README includes architecture diagram, threat model, feature matrix (working vs planned), setup, env reference, screenshots, test commands, deployed URLs, contract address, explorer links and exact demo steps.
- [ ] Public GitHub repo, demo post, submission description, team information, NEAR account address and selected track(s) ready before deadline.
- [ ] Verify all links work without judge-only credentials. If the hosted app needs authentication, supply a safe testnet demo path.
- [ ] Perform clean-clone test on fresh environment and repeat the complete demo flow.

## 11. Suggested delivery order and checkpoints

| Day | Focus | Evidence required |
|---|---|---|
| Nov 6 | Research, scaffold, contract skeleton | repo builds; testnet setup documented |
| Nov 7 | Vault policy and transfer execution | contract tests, first confirmed testnet transfer |
| Nov 8 | Contract security, approvals, async receipts | adversarial contract tests pass |
| Nov 9 | Risk engine and six-level authority | deterministic fixture tests |
| Nov 10 | Agent integration, restricted key | real agent proposal through vault |
| Nov 11 | Backend, approvals, audit persistence | end-to-end API tests |
| Nov 12 | Six purpose-built UI screens | working deployed frontend with real data |
| Nov 13 | Attack demo, clean-clone, video and docs | full recorded demo and public repo |
| Nov 14 | Buffer, final audit, submit by 23:59 UTC | submission receipt |

## 12. Scope boundaries and fallback

**Must ship:** restricted agent, vault, real testnet payments, deterministic risk scoring, six-level authority mapping, human approval, freeze, audit trail, purpose-built UI, tests and demo.

**Only if P0 is complete:** NEAR Intents/cross-chain payments, NEAR AI Cloud, multiple agents, automated payouts, production-grade ML, charts with advanced analytics, push notifications, mainnet.

**Fallback if time is short:** implement only one real agent and one testnet vault, three scripted agent scenarios and four fully working screens (`Overview`, `Payments`, `Approvals`, `Audit`). Keep Policy Studio and Agent Monitor as simple sections of Overview, while preserving contract enforcement and tests. Clearly label scripted scenario inputs. Never replace real testnet verification with fake data.

## 13. Final agent completion report

At completion, report: (1) checked/unchecked items, (2) live URL, (3) repository URL, (4) testnet vault contract ID, (5) successful and rejected transaction evidence, (6) exact tests and results, (7) known limitations, (8) demo instructions, and (9) remaining risks. If any evidence is missing, state it explicitly. Do not say `production-ready` for a hackathon MVP.
