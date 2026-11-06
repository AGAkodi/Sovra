# Throttle for NEAR - Implementation Log

## Phase 0: Orientation, Rules, and Research
- **Timestamp**: 2026-11-06 09:10 UTC
- **Decisions**:
  - Confirmed testnet-only architecture with deterministic risk engine and NEAR smart contract vault.
  - LLM outputs will propose tasks and payments, but will never authorize money movement directly.
  - Contract will enforce an attestation trust model where decisions are signed by an authorized policy signer or verified on-chain, binding `vault_id`, `request_id`, `recipient`, `amount`, `risk_band`, `authority_level`, `policy_version`, and `expiry`.
  - UI will strictly follow Section 8 specifications and the Unslop aesthetic guidelines (calm palette `#0B1018`, raised panels `#121B27`, borders `#273446`, cyan `#4CC9E8`, amber `#F2B544`, red `#EF6464`, green `#38C98B`, 4px spacing, tabular numbers, quiet chrome, zero AI-slop).
- **Toolchains**:
  - Node.js v26.13.0, npm 11.20.0 (invoked via `npm.cmd` on Windows due to PowerShell execution policy).
  - Rust toolchain with `wasm32-unknown-unknown` target for smart contracts.
- **Blockers & Mitigations**:
  - PowerShell execution policy blocks `.ps1` wrapper scripts; mitigated by invoking `.cmd` or explicit node runners.
  - Rust toolchain installation initiated via `rustup-init.exe` with minimal profile.

