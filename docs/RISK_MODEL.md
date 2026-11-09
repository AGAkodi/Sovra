# Sovra - Risk Engine & Authority Model Specification

## 1. Canonical Payment Proposal Schema
Each agent action creates a cryptographically and contextually bound proposal:
```typescript
interface PaymentProposal {
  agent_id: string;          // e.g. "agent-01.testnet"
  task_id: string;           // identifier of work completed
  recipient: string;         // NEAR account ID of payee
  token: "NEAR";             // Testnet native NEAR
  amount_yocto: string;      // 1 NEAR = 10^24 yoctoNEAR
  amount_near: number;       // human readable float
  timestamp: number;         // unix epoch milliseconds
  request_id: string;        // unique UUID / hex nonce
  task_evidence: {
    prompt: string;          // agent prompt or task trigger
    evidence_hash: string;   // sha256 of completed deliverables
    completion_summary: string;
  };
  policy_version: number;    // expected vault policy version
}
```

## 2. Deterministic Risk Components (0 - 100)
Risk scoring is strictly deterministic. Off-chain LLMs only generate proposals; the Sovra risk engine scores them using mathematically auditable features:

| Component | Weight | Calculation | Reason Codes |
|---|---|---|---|
| **Amount Anomaly** ($R_{amount}$) | 30% | $\min(100, (\text{amount} / \text{baseline\_median}) \times 25)$ | `AMOUNT_SPIKE`, `EXCEEDS_BASELINE` |
| **Transaction Velocity** ($R_{vel}$) | 20% | Count of tx in trailing 1h and 24h vs velocity limits | `VELOCITY_SPIKE`, `RATE_LIMIT_EXCEEDED` |
| **Recipient Novelty** ($R_{recip}$) | 25% | 0 if approved whitelist; 40 if seen before; 90 if unknown recipient | `UNKNOWN_RECIPIENT`, `UNVERIFIED_TARGET` |
| **Task Evidence Quality** ($R_{evid}$) | 15% | Validation of completion hash, prompt consistency, injection scan | `PROMPT_INJECTION_DETECTED`, `INVALID_EVIDENCE` |
| **Historical Failure Rate** ($R_{fail}$) | 10% | Rolling 24h rejection / chain failure ratio (RPC errors and vault refusals for freeze or low balance excluded) | `ELEVATED_FAILURE_RATE` |

Composite Risk Score:
$$R_{composite} = \min(100, \sum (w_i \cdot R_i))$$

If an agent has fewer than 5 successful payments, confidence is low, and a conservative prior penalty ($+20$ risk, reason `LOW_HISTORY_PRIOR`) is applied.

**Baseline.** The amount baseline is the median of the agent's most recent 20 *successful* payments, used only once there are at least 3; until then a configured default applies. Rejected, blocked, refused or failed proposals never enter it, so an attacker cannot raise the baseline by submitting large requests.

## 3. Trust Score & Decay Mechanics (0 - 100)
- **Baseline Neutral**: Starts at 50 for new agents.
- **Time Decay**: Decays asymptotically toward 50 at a half-life of 48 hours without verified activity:
  $$T_{new} = 50 + (T_{prev} - 50) \cdot e^{-\lambda \Delta t}$$
- **Penalties**:
  - Malicious injection / cap violation attempt: $-30$ trust immediately.
  - Rejected by owner: $-15$ trust.
  - On-chain failure: $-5$ trust (unless caused by transient RPC error).
- **Recovery**:
  - Verified on-chain successful payment with owner approval or normal execution: $+2$ trust (capped at 100, maximum $+10$ per 24 hours to prevent rapid artificial trust farming).

## 4. The Six Authority Levels
Sovra maps `(Risk Score, Trust Score, Hard Guardrails)` to exactly six authority tiers:

| Tier | Name | Criteria | Operational Enforcement |
|---|---|---|---|
| **Level 1** | **Full Autonomous** | Risk < 15, Trust $\ge 80$, Amount $\le 1\times$ baseline | Contract automatically transfers NEAR upon request verification. |
| **Level 2** | **Logged & Monitored** | Risk 15–34, Trust $\ge 65$, Amount $\le 2\times$ baseline | Automatic execution with high-priority audit telemetry logging. |
| **Level 3** | **Velocity Restricted** | Risk 35–54, Trust $\ge 50$, Per-hour cap enforced | Cooldown applied between payments; reduced per-tx allowance. |
| **Level 4** | **Monitored Warning** | Risk 55–69, Trust $\ge 35$, Evidence flags present | Operator alert dispatched; payment held if recipient is new. |
| **Level 5** | **Approval Required** | Risk 70–89 OR Amount > Cap OR Unknown recipient | Vault locks proposal as `PendingApproval`; requires owner wallet signature. |
| **Level 6** | **Frozen / Blocked** | Risk $\ge 90$ OR Freeze Flag Active OR Injection Flag | Vault execution refused unconditionally. Agent disabled until manual reset. |

## 5. Precedence Rules
1. **Owner Freeze** always overrides everything (immediate rejection).
2. **Hard Caps** (Vault contract `per_tx_cap` and `daily_budget`) cannot be bypassed by any risk or trust score.
3. **Approval Requirements** must be signed by the owner on-chain or via authenticated challenge.
4. An LLM may never grant itself higher authority or modify its own scores.

## 6. Implementation notes (engine `risk-v2`, `backend/src/risk/engine.ts`)
Where the spec leaves a choice open, the code does the following. Every evaluation stores `engine_version` and `policy_version` in its feature snapshot.

- **Amount anomaly.** Implemented as banded steps on the amount / baseline ratio (≤1.5× → 5, >1.5× → 35, >2.5× → 65, >5× → 90, above the per-tx cap → 100) instead of the continuous `ratio × 25` formula, so the boundaries are easy to audit.
- **Trust gains only on confirmed outcomes.** Evaluation never raises trust. +2 is applied when a payment is confirmed `Succeeded` on-chain (immediately, or when the reconciler sees it), at most +10 in any 24 h; −15 when the owner rejects a held request; −5 when a transfer fails on-chain. Each request moves trust at most once (`TrustUpdated` audit event). RPC errors, vault refusals and simulated results never move trust.
- **Attack penalty.** A prompt-injection or cap-violation attempt costs 30 trust at evaluation time, before anything reaches the chain.
- **Trust gates autonomy, not approval.** Levels 1–4 use the trust minimums in section 4. An agent whose trust is too low for levels 1–3 lands on level 4 (still executes, flagged). Trust alone never forces level 5: approval is triggered only by the level-5 criteria (risk ≥ 70, amount anomaly, unknown recipient) or by the vault's own checks.
- **Hysteresis.** After an incident (a level-6 block or an owner rejection) in the last 24 h, the agent cannot be more autonomous than level 3 until it completes 3 clean payments after that incident (reason `RECOVERING_FROM_INCIDENT`). Hysteresis only ever makes the level stricter.
- **What the vault enforces.** The contract holds level 5, rejects level 6, and independently holds anything over `max_risk_for_autonomous`, to a non-whitelisted recipient, or over the daily budget, and rejects anything over `per_tx_cap`. Levels 1–4 execute; the extra restrictions described for levels 3 and 4 (cooldowns, alerts) are recorded off-chain but not yet enforced.
