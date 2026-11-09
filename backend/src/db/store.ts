/**
 * Data layer.
 *
 *  - `store` is an in-memory cache of vault state. In testnet mode it is refreshed
 *    from the vault contract on every use, so it never needs persisting.
 *  - `repo` holds everything that must survive restarts and serverless cold starts:
 *    agent trust, payment requests, risk evaluations and the append-only audit log.
 *    It is backed by Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 *    otherwise by memory (tests, local simulation).
 */
import { RiskEvaluationResult, AuthorityLevel } from '../risk/engine';
import type { AgentProposal } from '../agent/llm';
import { REFERENCE, scaled } from '../demo';
import { MemoryRepository } from './memory-repo';
import { SupabaseRepository } from './supabase-repo';
import { DEFAULT_VAULT_ID } from './defaults';

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
  /** Testnet: what the agent can actually spend (balance − storage reserve − held requests), from the contract. */
  available_balance_near?: number;
  /** Testnet: NEAR locked for the contract's on-chain storage. */
  storage_reserve_near?: number;
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

export type RequestStatus = 'pending_approval' | 'approved' | 'executing' | 'succeeded' | 'failed' | 'rejected' | 'expired';

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
  status: RequestStatus;
  reason?: string;
  tx_hash?: string;
  /** 'testnet' = outcome read from the vault contract; 'simulation' = nothing was broadcast. */
  chain_mode: 'testnet' | 'simulation';
  /** Who made the final call: the off-chain risk engine, the vault contract, or the owner. */
  /** vault = recorded by the contract; vault_refused = the call panicked, nothing recorded on-chain. */
  decided_by?: 'risk_engine' | 'vault' | 'vault_refused' | 'owner' | 'rpc_error';
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
  /** How the agent proposed this payment (LLM with rationale, or scripted fallback). */
  agent?: AgentProposal;
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

export interface ListRequestsOptions {
  agentId?: string;
  statuses?: RequestStatus[];
  chainMode?: StoredRequest['chain_mode'];
  limit?: number;
}

export interface Repository {
  readonly kind: 'memory' | 'supabase';
  getAgent(id: string): Promise<StoredAgent | undefined>;
  listAgents(): Promise<StoredAgent[]>;
  saveAgent(agent: StoredAgent): Promise<void>;
  /** Newest first. */
  listRequests(opts?: ListRequestsOptions): Promise<StoredRequest[]>;
  getRequest(idOrRequestId: string): Promise<StoredRequest | undefined>;
  saveRequest(req: StoredRequest): Promise<void>;
  saveRiskEvaluation(evaluation: RiskEvaluationResult): Promise<void>;
  getRiskEvaluation(requestId: string): Promise<RiskEvaluationResult | undefined>;
  logAudit(eventType: string, actor: string, targetId?: string, details?: Record<string, unknown>, txHash?: string): Promise<void>;
  /** Newest first. */
  getAuditEvents(limit?: number): Promise<StoredAuditEvent[]>;
}

export { DEFAULT_VAULT_ID, DEFAULT_AGENT_ID, defaultAgent } from './defaults';

/** In-memory vault state cache (refreshed from chain in testnet mode). */
export class VaultCache {
  public vaults: Map<string, StoredVault> = new Map();

  constructor() {
    const vault: StoredVault = {
      id: DEFAULT_VAULT_ID,
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
    this.vaults.set(vault.id, vault);
  }

  public getVault(id: string): StoredVault | undefined {
    return this.vaults.get(id);
  }
}

export type StoreMode = 'memory' | 'supabase';

export function getStoreMode(): StoreMode {
  if (process.env.STORE_MODE === 'memory') return 'memory';
  const configured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.STORE_MODE === 'supabase' && !configured) {
    throw new Error('STORE_MODE=supabase but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.');
  }
  return configured ? 'supabase' : 'memory';
}

function createRepository(): Repository {
  return getStoreMode() === 'supabase'
    ? new SupabaseRepository(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : new MemoryRepository();
}

export const store = new VaultCache();
export const repo: Repository = createRepository();
