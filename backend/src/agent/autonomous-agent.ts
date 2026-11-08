import { v4 as uuidv4 } from 'uuid';
import { RiskEngine, PaymentProposal, RiskEvaluationResult } from '../risk/engine';
import { AttestationSigner } from '../risk/attestation';
import { repo, store, StoredRequest } from '../db/store';
import { getChainMode, getNearConfig, submitPaymentRequest, ChainSubmission } from '../near/client';
import { syncVaultFromChain, mapOnchainStatus } from '../near/sync';

export interface TaskJob {
  taskId: string;
  title: string;
  deliverableSummary: string;
  prompt: string;
  proposedPayee: string;
  proposedAmountNear: number;
}

export interface TaskPaymentResult {
  proposal: PaymentProposal;
  riskEvaluation: RiskEvaluationResult;
  attestationSignature?: string;
  requestStatus: StoredRequest['status'];
  chainMode: StoredRequest['chain_mode'];
  decidedBy: StoredRequest['decided_by'];
  message: string;
  txHash?: string;
}

/** Attestations are valid for 5 minutes after signing. */
const ATTESTATION_TTL_MS = 300_000;

export class AutonomousTaskAgent {
  private agentId: string;
  private riskEngine: RiskEngine;
  private signer: AttestationSigner;

  constructor(agentId: string, riskEngine: RiskEngine, signer: AttestationSigner) {
    this.agentId = agentId;
    this.riskEngine = riskEngine;
    this.signer = signer;
  }

  public async processTaskPayment(job: TaskJob): Promise<TaskPaymentResult> {
    const mode = getChainMode();
    const agent = await repo.getAgent(this.agentId);
    if (!agent) throw new Error(`Agent ${this.agentId} not found`);

    // In testnet mode the vault contract is the source of truth for freeze state and
    // policy version. If it can't be read, fail closed (ChainUnavailableError propagates).
    const vault = mode === 'testnet' ? await syncVaultFromChain(agent.vault_id) : store.getVault(agent.vault_id);
    if (!vault) throw new Error(`Vault ${agent.vault_id} not found`);
    if (mode === 'testnet') {
      // Score against the vault's actual hard limits and whitelist, not local defaults.
      this.riskEngine.setLimits(vault.per_tx_cap_near, vault.daily_budget_near);
      this.riskEngine.setWhitelistedRecipients(vault.allowed_recipients);
    }

    const requestId = `req-${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const now = Date.now();
    const expiryNs = (BigInt(now + ATTESTATION_TTL_MS) * 1_000_000n).toString();
    const amountYocto = (BigInt(Math.round(job.proposedAmountNear * 1e6)) * 10n ** 18n).toString();

    const proposal: PaymentProposal = {
      agent_id: agent.account_id,
      task_id: job.taskId,
      recipient: job.proposedPayee,
      token: 'NEAR',
      amount_near: job.proposedAmountNear,
      amount_yocto: amountYocto,
      timestamp: now,
      request_id: requestId,
      task_evidence: {
        prompt: job.prompt,
        evidence_hash: `sha256-${Buffer.from(job.deliverableSummary).toString('hex').substring(0, 32)}`,
        completion_summary: job.deliverableSummary,
      },
      policy_version: vault.policy_version,
    };

    const pastRequests = await repo.listRequests({ agentId: agent.id });
    const evaluation = this.riskEngine.evaluateProposal(proposal, {
      successful_payments: pastRequests
        .filter((r) => r.status === 'succeeded')
        .map((r) => ({ amount: r.amount_near, timestamp: r.created_at, recipient: r.recipient })),
      // RPC errors are not the agent's fault and must not count against it.
      failed_payments: pastRequests
        .filter((r) => (r.status === 'failed' || r.status === 'rejected') && r.decided_by !== 'rpc_error')
        .map((r) => ({ amount: r.amount_near, timestamp: r.created_at, recipient: r.recipient, reason: r.reason || 'Rejection' })),
      trust_score: agent.trust_score,
      last_activity_timestamp: agent.last_heartbeat,
      is_frozen: vault.is_frozen,
    });
    await repo.saveRiskEvaluation(evaluation);

    agent.trust_score = evaluation.new_trust_score;
    agent.authority_level = evaluation.authority_level;
    agent.last_heartbeat = now;
    await repo.saveAgent(agent);

    // Every decision is signed, including level 5 and 6: the vault enforces it and
    // records refusals on-chain, so blocked requests leave verifiable evidence.
    const signed = this.signer.signAttestation({
      chain_id: getNearConfig().networkId,
      vault_contract_id: vault.contract_id,
      request_id: requestId,
      recipient: job.proposedPayee,
      amount_yocto: amountYocto,
      risk_score: evaluation.composite_risk,
      authority_level: evaluation.authority_level,
      policy_version: vault.policy_version,
      expiry_ns: expiryNs,
    });

    const base: StoredRequest = {
      id: uuidv4(),
      vault_id: vault.id,
      agent_id: agent.id,
      request_id: requestId,
      recipient: job.proposedPayee,
      amount_near: job.proposedAmountNear,
      amount_yocto: amountYocto,
      risk_score: evaluation.composite_risk,
      authority_level: evaluation.authority_level,
      status: 'executing',
      reason: evaluation.reasons.join(', '),
      created_at: now,
      expiry_ns: expiryNs,
      task_evidence: proposal.task_evidence,
      chain_mode: mode,
      policy_version: vault.policy_version,
    };

    const { request, message } =
      mode === 'testnet'
        ? this.applyChainSubmission(base, evaluation, await submitPaymentRequest({
            request_id: requestId,
            recipient: job.proposedPayee,
            amount_yocto: amountYocto,
            expiry_ns: expiryNs,
            policy_version: vault.policy_version,
            risk_score: evaluation.composite_risk,
            authority_level: evaluation.authority_level,
            signature_hex: signed.signature_hex,
          }))
        : this.applySimulation(base, evaluation, vault.id);

    request.last_synced_at = Date.now();
    await repo.saveRequest(request);
    await repo.logAudit(auditEventFor(request), agent.account_id, requestId, {
      chain_mode: request.chain_mode,
      decided_by: request.decided_by,
      status: request.status,
      reasons: evaluation.reasons,
      risk: evaluation.composite_risk,
      authority_level: evaluation.authority_level,
      amount: job.proposedAmountNear,
      recipient: job.proposedPayee,
      policy_version: vault.policy_version,
      chain_reason: request.chain_reason,
    }, request.tx_hash);

    return {
      proposal,
      riskEvaluation: evaluation,
      attestationSignature: signed.signature_hex,
      requestStatus: request.status,
      chainMode: request.chain_mode,
      decidedBy: request.decided_by,
      message,
      txHash: request.tx_hash,
    };
  }

  private applyChainSubmission(
    req: StoredRequest,
    evaluation: RiskEvaluationResult,
    sub: ChainSubmission
  ): { request: StoredRequest; message: string } {
    req.tx_hash = sub.tx_hash;
    req.chain_reason = sub.reason;
    req.decided_by = 'vault';
    const now = Date.now();

    switch (sub.outcome) {
      case 'executing': {
        req.status = sub.onchain_request ? mapOnchainStatus(sub.onchain_request) : 'executing';
        if (req.status === 'succeeded' || req.status === 'failed') req.resolved_at = now;
        const verb = req.status === 'succeeded' ? 'confirmed on-chain' : req.status === 'failed' ? 'failed on-chain' : 'dispatched; awaiting receipt';
        return { request: req, message: `Transfer ${verb} (${evaluation.authority_name}).` };
      }
      case 'held':
        req.status = 'pending_approval';
        // Show the vault's approval deadline, not the 5-minute attestation expiry.
        if (sub.onchain_request) req.expiry_ns = sub.onchain_request.expiry_ns;
        return { request: req, message: `Vault holding request for owner approval: ${sub.reason}` };
      case 'rejected':
        req.status = 'rejected';
        req.resolved_at = now;
        return { request: req, message: `Vault rejected on-chain: ${sub.reason}` };
      case 'refused':
        req.status = 'rejected';
        req.resolved_at = now;
        return { request: req, message: `Vault refused the call: ${sub.reason}` };
      case 'rpc_error':
      default:
        req.status = 'failed';
        req.decided_by = 'rpc_error';
        req.resolved_at = now;
        return { request: req, message: `Could not reach NEAR RPC; outcome unknown, nothing assumed: ${sub.reason}` };
    }
  }

  /** Local-only flow. Results are labelled SIMULATION and carry no real tx hash. */
  private applySimulation(
    req: StoredRequest,
    evaluation: RiskEvaluationResult,
    vaultId: string
  ): { request: StoredRequest; message: string } {
    const vault = store.getVault(vaultId)!;
    req.decided_by = 'risk_engine';
    if (evaluation.is_blocked) {
      req.status = 'rejected';
      req.resolved_at = req.created_at;
      return { request: req, message: `SIMULATION: blocked by risk engine (risk ${evaluation.composite_risk}, level 6). Nothing broadcast.` };
    }
    if (evaluation.requires_owner_approval) {
      req.status = 'pending_approval';
      vault.reserved_balance_near += req.amount_near;
      store.vaults.set(vault.id, vault);
      return { request: req, message: `SIMULATION: held for owner approval (risk ${evaluation.composite_risk}, level 5). Nothing broadcast.` };
    }
    req.status = 'succeeded';
    req.resolved_at = req.created_at;
    req.tx_hash = `sim-${req.request_id}`;
    vault.vault_balance_near -= req.amount_near;
    vault.daily_spent_near += req.amount_near;
    store.vaults.set(vault.id, vault);
    return { request: req, message: `SIMULATION: payment would execute (${evaluation.authority_name}). No transaction broadcast.` };
  }
}

function auditEventFor(req: StoredRequest): string {
  const prefix = req.chain_mode === 'simulation' ? 'Simulated' : '';
  switch (req.status) {
    case 'succeeded':
      return `${prefix}PaymentSucceeded`;
    case 'pending_approval':
      return `${prefix}PaymentHeldForApproval`;
    case 'rejected':
      return req.decided_by === 'vault' ? 'PaymentRejectedOnChain' : `${prefix}PaymentBlockedByRiskEngine`;
    case 'failed':
      return req.decided_by === 'rpc_error' ? 'PaymentRpcError' : 'PaymentFailedOnChain';
    default:
      return `${prefix}PaymentDispatched`;
  }
}
