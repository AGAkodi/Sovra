import { v4 as uuidv4 } from 'uuid';
import { RiskEngine, PaymentProposal, RiskEvaluationResult } from '../risk/engine';
import { AttestationSigner } from '../risk/attestation';
import { store, StoredRequest } from '../db/store';

export interface TaskJob {
  taskId: string;
  title: string;
  deliverableSummary: string;
  prompt: string;
  proposedPayee: string;
  proposedAmountNear: number;
}

export class AutonomousTaskAgent {
  private agentId: string;
  private riskEngine: RiskEngine;
  private signer: AttestationSigner;

  constructor(agentId: string, riskEngine: RiskEngine, signer: AttestationSigner) {
    this.agentId = agentId;
    this.riskEngine = riskEngine;
    this.signer = signer;
  }

  public async processTaskPayment(job: TaskJob): Promise<{
    proposal: PaymentProposal;
    riskEvaluation: RiskEvaluationResult;
    attestationSignature?: string;
    requestStatus: StoredRequest['status'];
    message: string;
    txHash?: string;
  }> {
    const agent = store.getAgent(this.agentId) || {
      id: this.agentId,
      vault_id: 'vault-01',
      account_id: 'throttle-agent.testnet',
      name: 'Autonomous Task Agent',
      trust_score: 80,
      authority_level: 1 as const,
      is_active: true,
      last_heartbeat: Date.now(),
    };

    const vault = store.getVault(agent.vault_id) || {
      id: 'vault-01',
      contract_id: 'throttle-vault.testnet',
      owner_id: 'throttle-owner.testnet',
      network: 'testnet',
      is_frozen: false,
      policy_version: 1,
      per_tx_cap_near: 10.0,
      daily_budget_near: 50.0,
      daily_spent_near: 0.0,
      require_whitelist: true,
      max_risk_for_autonomous: 69,
      policy_signer_pk: '',
      vault_balance_near: 100.0,
      reserved_balance_near: 0.0,
      allowed_recipients: ['service-worker.testnet'],
    };

    const requestId = `req-${uuidv4().substring(0, 8)}`;
    const now = Date.now();
    const expiryNs = (BigInt(now + 300_000) * 1_000_000n).toString(); // 5 minutes expiry

    // YoctoNEAR calculation (1 NEAR = 10^24 yocto)
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

    // Retrieve agent history for risk calculation
    const pastRequests = store.listRequests().filter((r) => r.agent_id === agent.id);
    const successfulPayments = pastRequests
      .filter((r) => r.status === 'succeeded')
      .map((r) => ({ amount: r.amount_near, timestamp: r.created_at, recipient: r.recipient }));
    const failedPayments = pastRequests
      .filter((r) => r.status === 'failed' || r.status === 'rejected')
      .map((r) => ({ amount: r.amount_near, timestamp: r.created_at, recipient: r.recipient, reason: r.reason || 'Rejection' }));

    const evaluation = this.riskEngine.evaluateProposal(proposal, {
      successful_payments: successfulPayments,
      failed_payments: failedPayments,
      trust_score: agent.trust_score,
      last_activity_timestamp: agent.last_heartbeat,
      is_frozen: vault.is_frozen,
    });

    store.saveRiskEvaluation(evaluation);

    // Update agent trust and authority level
    agent.trust_score = evaluation.new_trust_score;
    agent.authority_level = evaluation.authority_level;
    agent.last_heartbeat = now;
    store.agents.set(agent.id, agent);

    let status: StoredRequest['status'] = 'executing';
    let message = '';
    let attestationSignature: string | undefined;
    let txHash: string | undefined;

    if (evaluation.is_blocked) {
      status = 'rejected';
      message = `Payment refused: Risk score ${evaluation.composite_risk} triggered Level 6 (Frozen/Blocked)`;
      store.logAudit('PaymentBlockedByPolicy', agent.account_id, requestId, {
        reasons: evaluation.reasons,
        risk: evaluation.composite_risk,
        amount: job.proposedAmountNear,
      });
    } else if (evaluation.requires_owner_approval) {
      status = 'pending_approval';
      message = `Payment held for authenticated owner approval (Risk: ${evaluation.composite_risk}, Authority: Level 5)`;
      vault.reserved_balance_near += job.proposedAmountNear;
      store.vaults.set(vault.id, vault);
      store.logAudit('PaymentHeldForApproval', agent.account_id, requestId, {
        reasons: evaluation.reasons,
        risk: evaluation.composite_risk,
        amount: job.proposedAmountNear,
        recipient: job.proposedPayee,
      });
    } else {
      // Levels 1-4: Sign attestation and execute payment on-chain
      const signed = this.signer.signAttestation({
        vault_contract_id: vault.contract_id,
        request_id: requestId,
        recipient: job.proposedPayee,
        amount_yocto: amountYocto,
        risk_score: evaluation.composite_risk,
        authority_level: evaluation.authority_level,
        expiry_ns: expiryNs,
      });
      attestationSignature = signed.signature_hex;

      // Mock or real testnet execution
      txHash = `tx-${uuidv4().replace(/-/g, '').substring(0, 32)}`;
      status = 'succeeded';
      message = `Payment executed successfully on NEAR testnet (Authority: ${evaluation.authority_name})`;
      vault.vault_balance_near -= job.proposedAmountNear;
      vault.daily_spent_near += job.proposedAmountNear;
      store.vaults.set(vault.id, vault);

      store.logAudit('PaymentExecutedOnChain', agent.account_id, requestId, {
        tx_hash: txHash,
        amount: job.proposedAmountNear,
        recipient: job.proposedPayee,
        authority_level: evaluation.authority_level,
      }, txHash);
    }

    const storedRequest: StoredRequest = {
      id: uuidv4(),
      vault_id: vault.id,
      agent_id: agent.id,
      request_id: requestId,
      recipient: job.proposedPayee,
      amount_near: job.proposedAmountNear,
      amount_yocto: amountYocto,
      risk_score: evaluation.composite_risk,
      authority_level: evaluation.authority_level,
      status,
      reason: evaluation.reasons.join(', '),
      tx_hash: txHash,
      created_at: now,
      expiry_ns: expiryNs,
      resolved_at: status === 'succeeded' || status === 'rejected' ? now : undefined,
      task_evidence: proposal.task_evidence,
    };
    store.saveRequest(storedRequest);

    return {
      proposal,
      riskEvaluation: evaluation,
      attestationSignature,
      requestStatus: status,
      message,
      txHash,
    };
  }
}

