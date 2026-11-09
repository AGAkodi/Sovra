export interface Vault {
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
  /** Testnet: true when the backend could not re-read the contract and served cached state. */
  stale?: boolean;
  sync_error?: string;
}

export interface Agent {
  id: string;
  vault_id: string;
  account_id: string;
  name: string;
  trust_score: number;
  authority_level: number;
  is_active: boolean;
  last_heartbeat: number;
}

export interface PaymentRequest {
  id: string;
  vault_id: string;
  agent_id: string;
  request_id: string;
  recipient: string;
  amount_near: number;
  amount_yocto: string;
  risk_score: number;
  authority_level: number;
  status: 'pending_approval' | 'approved' | 'executing' | 'succeeded' | 'failed' | 'rejected' | 'expired';
  reason?: string;
  tx_hash?: string;
  chain_mode: 'testnet' | 'simulation';
  decided_by?: 'risk_engine' | 'vault' | 'vault_refused' | 'owner' | 'rpc_error';
  chain_reason?: string;
  policy_version?: number;
  last_synced_at?: number;
  agent?: AgentProposal;
  created_at: number;
  expiry_ns: string;
  resolved_at?: number;
  task_evidence: {
    prompt: string;
    evidence_hash: string;
    completion_summary: string;
  };
}

export interface AgentProposal {
  recipient: string;
  amount_near: number;
  rationale: string;
  task_category: string;
  mode: 'llm' | 'scripted';
  model?: string;
  fallback_reason?: string;
  latency_ms?: number;
  declined?: boolean;
  decline_reason?: string;
}

/** Response of POST /scenarios/run. `declined` means the agent refused and nothing was submitted. */
export interface ScenarioOutcome {
  declined?: boolean;
  requestStatus: PaymentRequest['status'] | 'declined';
  chainMode?: 'testnet' | 'simulation';
  decidedBy?: PaymentRequest['decided_by'];
  message: string;
  txHash?: string;
  agent?: AgentProposal;
  proposal?: { request_id: string; amount_near: number; recipient: string };
  riskEvaluation?: { composite_risk: number; authority_level: number; authority_name: string };
}

export interface TrustPoint {
  t: number;
  trust: number;
  delta?: number;
  cause?: string;
  request_id?: string;
}

export interface RiskEvaluation {
  request_id: string;
  agent_id: string;
  recipient: string;
  amount_near: number;
  composite_risk: number;
  components: {
    amount_risk: number;
    velocity_risk: number;
    recipient_risk: number;
    evidence_risk: number;
    failure_risk: number;
  };
  reasons: string[];
  authority_level: number;
  authority_name: string;
  requires_owner_approval: boolean;
  is_blocked: boolean;
  new_trust_score: number;
  feature_snapshot: Record<string, unknown>;
  evaluated_at: number;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  actor: string;
  target_id?: string;
  details: Record<string, unknown>;
  tx_hash?: string;
  timestamp: number;
}

export interface Health {
  status: string;
  network: string;
  chain_mode: 'testnet' | 'simulation';
  store_mode?: 'memory' | 'supabase';
  agent_mode?: 'llm' | 'scripted';
  agent_model?: string | null;
  demo_scale?: number;
  vault_contract_id: string | null;
  policy_signer: string;
  policy_signer_ephemeral: boolean;
}

// Local dev: Vite proxies /api to the backend. Hosted: set VITE_API_BASE to the backend URL.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');

export const api = {
  async getHealth(): Promise<Health> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend unreachable');
    return res.json();
  },

  /** Re-reads one request from the vault contract (after an owner wallet action). */
  async syncRequest(id: string): Promise<{ changed: boolean; request: PaymentRequest }> {
    const res = await fetch(`${API_BASE}/payment-requests/${id}/sync`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Sync failed');
    return body;
  },

  async getVault(id: string = 'vault-01'): Promise<Vault> {
    const res = await fetch(`${API_BASE}/vaults/${id}`);
    if (!res.ok) throw new Error('Failed to fetch vault');
    return res.json();
  },

  async getAgents(): Promise<Agent[]> {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error('Failed to fetch agents');
    return res.json();
  },

  async getPaymentRequests(status?: string): Promise<PaymentRequest[]> {
    const url = status && status !== 'all'
      ? `${API_BASE}/payment-requests?status=${status}`
      : `${API_BASE}/payment-requests`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch requests');
    return res.json();
  },

  async getPaymentRequestDetails(id: string): Promise<{ request: PaymentRequest; evaluation?: RiskEvaluation }> {
    const res = await fetch(`${API_BASE}/payment-requests/${id}`);
    if (!res.ok) throw new Error('Failed to fetch request details');
    return res.json();
  },

  async approveRequest(id: string): Promise<{ success: boolean; request: PaymentRequest }> {
    const res = await fetch(`${API_BASE}/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve request');
    }
    return res.json();
  },

  async rejectRequest(id: string, reason: string): Promise<{ success: boolean; request: PaymentRequest }> {
    const res = await fetch(`${API_BASE}/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reject request');
    }
    return res.json();
  },

  async freezeAgent(agentId: string = 'agent-01', reason?: string) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to freeze agent');
    return body;
  },

  async unfreezeAgent(agentId: string = 'agent-01') {
    const res = await fetch(`${API_BASE}/agents/${agentId}/unfreeze`, {
      method: 'POST',
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to unfreeze agent');
    return body;
  },

  async updatePolicy(policy: {
    perTxCapNear?: number;
    dailyBudgetNear?: number;
    requireWhitelist?: boolean;
    maxRiskForAutonomous?: number;
  }) {
    const res = await fetch(`${API_BASE}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update policy');
    return body;
  },

  async runScenario(scenario: 'routine' | 'spike' | 'injection'): Promise<ScenarioOutcome> {
    const res = await fetch(`${API_BASE}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Scenario run failed');
    }
    return res.json();
  },

  async getTrustHistory(days = 7, agentId = 'agent-01'): Promise<{ points: TrustPoint[]; current: number }> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/trust?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch trust history');
    return res.json();
  },

  async getEvents(limit: number = 50): Promise<AuditEvent[]> {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  },
};

