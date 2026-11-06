# Throttle for NEAR - Technical Research & References

## 1. Hackathon Track & Submission Context
- **Target Event**: NEAR Hackathon 2026 (AI Security & Defense track).
- **Core Mission**: Enforce deterministic, cryptographically attested spending guardrails on autonomous AI agents using a native NEAR Rust smart contract vault with independent on-chain verification.

## 2. NEAR Smart Contract & Protocol Specifications
- **SDK**: `near-sdk` v5.7+ with Rust 2021 edition.
- **Access Keys**:
  - **Owner**: FullAccess key capable of calling administrative methods (`set_policy`, `approve_request`, `reject_request`, `freeze`, `unfreeze`).
  - **Agent**: FunctionCall key restricted strictly to `receiver_id: <vault_contract_id>` and `method_names: ["request_payment"]`. The agent has zero direct transfer capability.
- **Cross-Contract Execution & Receipts**:
  - Asynchronous transfer pattern:
    1. Pre-transfer: Reserve payment amount from available balance; record request state as `Executing`.
    2. Dispatch: `Promise::new(recipient).transfer(amount)` with gas-allocated callback.
    3. Callback: Private method `on_transfer_complete` (enforced via `env::current_account_id() == env::predecessor_account_id()`) checks `is_promise_success()`.
    4. Post-transfer: If successful, mark request `Succeeded` and deduct from daily budget. If failed, mark `Failed` and revert reservation.
- **Attestation Cryptography**:
  - Deterministic serialization of `(vault_id, request_id, recipient, amount, risk_score, authority_level, policy_version, expiry)`.
  - Signature verification via `env::ed25519_verify` against the owner-designated `policy_signer_pk`.
  - Prevents replay (unique request IDs, expiry), tamper (recipient and amount bound to signature), and rogue backend scores.

## 3. Toolchain & Dependencies Matrix
- Contract: Rust (`wasm32-unknown-unknown`), `near-sdk = "5.7.0"` (or compatible 5.x)
- Backend: Node.js 26+, TypeScript 5+, Express/Fastify, `near-api-js`, tweetnacl / ed25519-hd-key
- Frontend: React 18/19, Vite, Tailwind CSS, Lucide icons, `@near-wallet-selector`
- Storage: PostgreSQL / Supabase with schema migrations for payment events, risk evaluations, and audit trail

