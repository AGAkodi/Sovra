import { v4 as uuidv4 } from 'uuid';
import { PaymentProposal, RiskEvaluationResult, AuthorityLevel } from '../risk/engine';
import { REFERENCE, scaled } from '../demo';

export interface StoredVault {
  id: string;
  contract_id: string;
  owner_id: string;
  network: string;
  is_frozen: boolean;
  policy_version: number;
  per_tx_cap_near: number;
  daily_budget_near: number;
  daily_spent_near: number;
  require_whitelist: boolean;
  max_risk_for_autonomous: number;
  policy_signer_pk: string;
  vault_balance_near: number;
  reserved_balance_near: number;
  allowed_recipients: string[];
  last_synced_at?: number;
}

export interface StoredAgent {
  id: string;
  vault_id: string;
  account_id: string;
  name: string;
  trust_score: number;
  authority_level: AuthorityLevel;
  is_active: boolean;
  last_heartbeat: number;
}

export interface StoredRequest {
  id: string;
  vault_id: string;
  agent_id: string;
  request_id: string;
  recipient: string;
  amount_near: number;
  amount_yocto: string;
  risk_score: number;
  authority_level: AuthorityLevel;
  status: 'pending_approval' | 'approved' | 'executing' | 'succeeded' | 'failed' | 'rejected' | 'expired';
  reason?: string;
  tx_hash?: string;
  /** 'testnet' = outcome read from the vault contract; 'simulation' = nothing was broadcast. */
  chain_mode: 'testnet' | 'simulation';
  /** Who made the final call: the off-chain risk engine, the vault contract, or the owner. */
  decided_by?: 'risk_engine' | 'vault' | 'owner' | 'rpc_error';
  /** Raw reason the vault gave (rejection / panic / failure), when known. */
  chain_reason?: string;
  policy_version?: number;
  last_synced_at?: number;
  created_at: number;
  expiry_ns: string;
  resolved_at?: number;
  task_evidence: {
    prompt: string;
    evidence_hash: string;
    completion_summary: string;
  };
}

export interface StoredAuditEvent {
  id: string;
  event_type: string;
  actor: string;
  target_id?: string;
  details: Record<string, unknown>;
  tx_hash?: string;
  timestamp: number;
}

export class MemoryStore {
  public vaults: Map<string, StoredVault> = new Map();
  public agents: Map<string, StoredAgent> = new Map();
  public requests: Map<string, StoredRequest> = new Map();
  public riskEvaluations: Map<string, RiskEvaluationResult> = new Map();
  public auditEvents: StoredAuditEvent[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const vaultId = 'vault-01';
    const agentId = 'agent-01';

    const vault: StoredVault = {
      id: vaultId,
      contract_id: process.env.VAULT_CONTRACT_ID || 'throttle-vault.testnet',
      owner_id: process.env.OWNER_ACCOUNT_ID || 'throttle-owner.testnet',
      network: 'testnet',
      is_frozen: false,
      policy_version: 1,
      per_tx_cap_near: scaled(REFERENCE.perTxCapNear),
      daily_budget_near: scaled(REFERENCE.dailyBudgetNear),
      daily_spent_near: 0.0,
      require_whitelist: true,
      max_risk_for_autonomous: 69,
      policy_signer_pk: '',
      vault_balance_near: scaled(REFERENCE.dailyBudgetNear),
      reserved_balance_near: 0.0,
      // In testnet mode this is replaced by the vault's on-chain whitelist on every sync.
      allowed_recipients: [process.env.RECIPIENT_ACCOUNT_ID || 'service-worker.testnet', 'oracle-node.testnet'],
    };
    this.vaults.set(vaultId, vault);

    const agent: StoredAgent = {
      id: agentId,
      vault_id: vaultId,
      account_id: process.env.AGENT_ACCOUNT_ID || 'throttle-agent.testnet',
      name: 'Autonomous Task Paying Agent',
      trust_score: 82.5,
      authority_level: 1,
      is_active: true,
      last_heartbeat: Date.now(),
    };
    this.agents.set(agentId, agent);

    this.logAudit('VaultInitialized', 'system', vaultId, {
      owner_id: vault.owner_id,
      contract_id: vault.contract_id,
      per_tx_cap: vault.per_tx_cap_near,
    });
  }

  public getVault(id: string): StoredVault | undefined {
    return this.vaults.get(id);
  }

  public getAgent(id: string): StoredAgent | undefined {
    return this.agents.get(id);
  }

  public listAgents(): StoredAgent[] {
    return Array.from(this.agents.values());
  }

  public listRequests(): StoredRequest[] {
    return Array.from(this.requests.values()).sort((a, b) => b.created_at - a.created_at);
  }

  public getRequest(idOrRequestId: string): StoredRequest | undefined {
    for (const req of this.requests.values()) {
      if (req.id === idOrRequestId || req.request_id === idOrRequestId) {
        return req;
      }
    }
    return undefined;
  }

  public saveRequest(req: StoredRequest) {
    this.requests.set(req.id, req);
  }

  public saveRiskEvaluation(evaluation: RiskEvaluationResult) {
    this.riskEvaluations.set(evaluation.request_id, evaluation);
  }

  public logAudit(
    event_type: string,
    actor: string,
    target_id?: string,
    details: Record<string, unknown> = {},
    tx_hash?: string
  ) {
    const event: StoredAuditEvent = {
      id: uuidv4(),
      event_type,
      actor,
      target_id,
      details,
      tx_hash,
      timestamp: Date.now(),
    };
    this.auditEvents.unshift(event);
    if (this.auditEvents.length > 500) {
      this.auditEvents.pop();
    }
  }

  public getAuditEvents(limit: number = 50): StoredAuditEvent[] {
    return this.auditEvents.slice(0, limit);
  }
}

export const store = new MemoryStore();
