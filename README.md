# Throttle for NEAR

> **Adaptive Spending Control & Security Vault for Autonomous AI Agents on NEAR Protocol**  
> *Target: NEAR Hackathon 2026 - AI Security & Defense Track*

---

## 1. Overview
Throttle is a security layer that gives autonomous AI agents the freedom to pay for compute, data, and human task completions—without ever giving them raw treasury keys or unbounded transfer authority.

Every payment proposed by an autonomous agent passes through **Throttle's Risk & Drift Engine**, receives a cryptographically signed attestation, and is independently verified by a **NEAR Rust Smart Contract Vault**.

```
[ AI Task Agent ] 
       │ (Proposes Payment with Task Evidence)
       ▼
[ Throttle Risk Engine ] ── (Calculates Risk, Drift & Trust Score)
       │ (Signs Attestation: Ed25519)
       ▼
[ NEAR Vault Contract ] ── (Verifies Attestation, Policy Caps & Whitelist)
   ├── Level 1-4: Autonomous Execution (Native NEAR Transfer)
   ├── Level 5:   Held for Owner Approval (Requires Wallet Signature)
   └── Level 6:   Blocked / Frozen (Refusal & Security Alert)
```

## 2. Core Pillars
1. **Zero Raw Treasury Access**: Agents receive only restricted NEAR `FunctionCall` keys limited to calling `request_payment` on the vault.
2. **Deterministic Risk Scoring**: 5-factor scoring model ($R_{amount}$, $R_{vel}$, $R_{recip}$, $R_{evid}$, $R_{fail}$) that cannot be manipulated by prompt injections.
3. **Decaying Trust & 6 Authority Levels**: Trust decays safely toward neutral over time; six distinct operational enforcement modes.
4. **On-Chain Attestation Verification**: Ed25519 signature verified on NEAR via `env::ed25519_verify`.
5. **Human-in-the-Loop Approvals**: Suspicious or high-value payments require an explicit owner wallet signature before funds can leave the contract.
6. **Unslop Design System**: Built with strict typography, high-contrast accessible palettes, 4px grid rhythm, and zero AI clutter.

---

## 3. Repository Structure
```
Sovra/
├── contracts/throttle-vault/    # NEAR Rust smart contract (near-sdk v5.7)
├── agent/                       # Autonomous task-paying agent with restricted key
├── backend/                     # Node.js TypeScript API, risk engine & attestation signer
├── frontend/                    # Vite + React + TypeScript + Tailwind UI (Section 8 spec)
├── supabase/migrations/         # PostgreSQL schema for audit trail and events
├── scripts/                     # Deployment, keygen, and scenario simulation scripts
├── tests/e2e/                   # End-to-end integration test suite
├── docs/                        # Research, risk model, security test reports
└── TODO.md                      # Phase-by-phase implementation checklist
```

---

## 4. Quickstart

### Prerequisites
- Node.js v20+ / v26+
- Rust toolchain with `wasm32-unknown-unknown` target
- NEAR CLI or testnet credentials

### Build & Test Smart Contract
```bash
cd contracts/throttle-vault
cargo build --target wasm32-unknown-unknown --release
cargo test
```

### Run Backend & Risk Engine
```bash
cd backend
npm install
npm run dev
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
```

