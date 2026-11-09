import { v4 as uuidv4 } from 'uuid';
import type { RiskEvaluationResult } from '../risk/engine';
import type { ListRequestsOptions, Repository, StoredAgent, StoredAuditEvent, StoredRequest } from './store';
import { defaultAgent, DEFAULT_VAULT_ID } from './defaults';

/** Non-persistent repository for tests and local simulation. Lost on restart. */
export class MemoryRepository implements Repository {
  public readonly kind = 'memory' as const;
  private agents = new Map<string, StoredAgent>();
  private requests = new Map<string, StoredRequest>();
  private evaluations = new Map<string, RiskEvaluationResult>();
  private audit: StoredAuditEvent[] = [];

  constructor() {
    this.reset();
  }

  /** Test helper: back to the seeded initial state. */
  public reset(): void {
    this.agents.clear();
    this.requests.clear();
    this.evaluations.clear();
    this.audit = [];
    const agent = defaultAgent();
    this.agents.set(agent.id, agent);
    void this.logAudit('VaultInitialized', 'system', DEFAULT_VAULT_ID, { store: 'memory' });
  }

  async getAgent(id: string) {
    const a = this.agents.get(id);
    return a ? { ...a } : undefined;
  }

  async listAgents() {
    return Array.from(this.agents.values()).map((a) => ({ ...a }));
  }

  async saveAgent(agent: StoredAgent) {
    this.agents.set(agent.id, { ...agent });
  }

  async listRequests(opts: ListRequestsOptions = {}) {
    let list = Array.from(this.requests.values());
    if (opts.agentId) list = list.filter((r) => r.agent_id === opts.agentId);
    if (opts.statuses) list = list.filter((r) => opts.statuses!.includes(r.status));
    if (opts.chainMode) list = list.filter((r) => r.chain_mode === opts.chainMode);
    list.sort((a, b) => b.created_at - a.created_at);
    return (opts.limit ? list.slice(0, opts.limit) : list).map((r) => ({ ...r }));
  }

  async getRequest(idOrRequestId: string) {
    for (const r of this.requests.values()) {
      if (r.id === idOrRequestId || r.request_id === idOrRequestId) return { ...r };
    }
    return undefined;
  }

  async saveRequest(req: StoredRequest) {
    this.requests.set(req.id, { ...req });
  }

  async saveRiskEvaluation(evaluation: RiskEvaluationResult) {
    this.evaluations.set(evaluation.request_id, evaluation);
  }

  async getRiskEvaluation(requestId: string) {
    return this.evaluations.get(requestId);
  }

  async listRiskEvaluations(sinceMs: number, limit = 200) {
    return [...this.evaluations.values()]
      .filter((e) => e.evaluated_at >= sinceMs)
      .sort((a, b) => b.evaluated_at - a.evaluated_at)
      .slice(0, limit);
  }

  async logAudit(eventType: string, actor: string, targetId?: string, details: Record<string, unknown> = {}, txHash?: string) {
    this.audit.unshift({ id: uuidv4(), event_type: eventType, actor, target_id: targetId, details, tx_hash: txHash, timestamp: Date.now() });
    if (this.audit.length > 500) this.audit.pop();
  }

  async getAuditEvents(limit = 50) {
    return this.audit.slice(0, limit);
  }
}
