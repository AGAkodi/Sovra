# Throttle for NEAR - Risk Engine & Authority Model Specification

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
Risk scoring is strictly deterministic. Off-chain LLMs only generate proposals; the Throttle risk engine scores them using mathematically auditable features:

| Component | Weight | Calculation | Reason Codes |
|---|---|---|---|
| **Amount Anomaly** ($R_{amount}$) | 30% | $\min(100, (\text{amount} / \text{baseline\_median}) \times 25)$ | `AMOUNT_SPIKE`, `EXCEEDS_BASELINE` |
| **Transaction Velocity** ($R_{vel}$) | 20% | Count of tx in trailing 1h and 24h vs velocity limits | `VELOCITY_SPIKE`, `RATE_LIMIT_EXCEEDED` |
| **Recipient Novelty** ($R_{recip}$) | 25% | 0 if approved whitelist; 40 if seen before; 90 if unknown recipient | `UNKNOWN_RECIPIENT`, `UNVERIFIED_TARGET` |
| **Task Evidence Quality** ($R_{evid}$) | 15% | Validation of completion hash, prompt consistency, injection scan | `PROMPT_INJECTION_DETECTED`, `INVALID_EVIDENCE` |
| **Historical Failure Rate** ($R_{fail}$) | 10% | Rolling 24h rejection / chain failure ratio | `HIGH_FAILURE_RATE` |

Composite Risk Score:
$$R_{composite} = \min(100, \sum (w_i \cdot R_i))$$

If an agent has fewer than 5 historical transactions, confidence is low, and a conservative prior penalty ($+20$ risk) is applied.

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
Throttle maps `(Risk Score, Trust Score, Hard Guardrails)` to exactly six authority tiers:

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

