# Security Policy

## Threat Model & Security Architecture

Sovra is designed to enforce strict, deterministic financial boundaries on autonomous AI agents. The security architecture addresses the following threats:

### 1. Rogue or Prompt-Injected Agent Proposals
- **Threat**: An LLM agent compromised via indirect prompt injection attempts to transfer treasury funds to an attacker-controlled account or drain the vault with an excessive payment.
- **Defense**:
  1. The agent never possesses a FullAccess treasury key.
  2. The agent only holds a NEAR FunctionCall key restricted to calling `request_payment` on the Vault contract.
  3. The Vault smart contract independently enforces immutable hard caps (`per_tx_cap`, `daily_budget`), whitelisted recipients, and owner approval gates.
  4. Off-chain risk engine verifies task evidence and rejects prompt-injected proposals before signing.
  5. If risk $\ge 70$, or if the recipient is unknown, the vault places the request into an on-chain `PendingApproval` state requiring the vault owner's authenticated signature.

### 2. Attestation Forgery and Replay Attacks
- **Threat**: An attacker attempts to forge a risk attestation or replay a previously approved payment request.
- **Defense**:
  1. Attestations are Ed25519-signed by the designated policy signer and bound to `(vault_id, request_id, recipient, amount, risk_score, authority_level, policy_version, expiry)`.
  2. The Vault contract verifies the cryptographic signature on-chain via `env::ed25519_verify`.
  3. Every request ID must be globally unique; replayed request IDs are rejected.
  4. Attestations expire within 300 seconds (configurable); stale attestations fail on-chain.
  5. Policy versions must match the current contract policy version.

### 3. Asynchronous Double-Spending & Race Conditions
- **Threat**: Rapid parallel payment requests attempt to exceed remaining daily budgets before previous transfers settle on NEAR.
- **Defense**:
  1. The vault reserves funds immediately upon request initiation.
  2. Asynchronous NEAR transfers execute with a private callback (`#[private]` `on_transfer_complete`).
  3. The callback safely reconciles status: on success, budget is updated; on failure, the reservation is released.

### 4. Out-of-Scope Risks
- Compromise of the Owner's root private key.
- Total compromise of the underlying NEAR RPC nodes (mitigated by using verifiable archival/consensus receipts).

