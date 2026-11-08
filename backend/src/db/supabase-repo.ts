/**
 * Supabase-backed repository (PostgREST over HTTPS, so it works from serverless
 * functions without a connection pool). Uses the service-role key, which must only
 * ever be configured on the backend; RLS is enabled on every table with no policies,
 * so the public anon key can read nothing.
 *
 * Schema: supabase/migrations/20261108000001_runtime_schema.sql
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RiskEvaluationResult } from '../risk/engine';
import type { ListRequestsOptions, Repository, StoredAgent, StoredAuditEvent, StoredRequest } from './store';
import { defaultAgent } from './defaults';

type Row = Record<string, unknown>;

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const optNum = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const optStr = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));

function toAgent(r: Row): StoredAgent {
  return {
    id: String(r.id),
    vault_id: String(r.vault_id),
    account_id: String(r.account_id),
    name: String(r.name),
    trust_score: num(r.trust_score),
    authority_level: num(r.authority_level) as StoredAgent['authority_level'],
    is_active: Boolean(r.is_active),
    last_heartbeat: num(r.last_heartbeat),
  };
}

function toRequest(r: Row): StoredRequest {
  return {
    id: String(r.id),
    vault_id: String(r.vault_id),
    agent_id: String(r.agent_id),
    request_id: String(r.request_id),
    recipient: String(r.recipient),
    amount_near: num(r.amount_near),
    amount_yocto: String(r.amount_yocto),
    risk_score: num(r.risk_score),
    authority_level: num(r.authority_level) as StoredRequest['authority_level'],
    status: r.status as StoredRequest['status'],
    reason: optStr(r.reason),
    tx_hash: optStr(r.tx_hash),
    chain_mode: r.chain_mode as StoredRequest['chain_mode'],
    decided_by: optStr(r.decided_by) as StoredRequest['decided_by'],
    chain_reason: optStr(r.chain_reason),
    policy_version: optNum(r.policy_version),
    last_synced_at: optNum(r.last_synced_at),
    created_at: num(r.created_at),
    expiry_ns: String(r.expiry_ns),
    resolved_at: optNum(r.resolved_at),
    task_evidence: r.task_evidence as StoredRequest['task_evidence'],
    agent: (r.agent as StoredRequest['agent']) ?? undefined,
  };
}

function fromRequest(req: StoredRequest): Row {
  return {
    id: req.id,
    vault_id: req.vault_id,
    agent_id: req.agent_id,
    request_id: req.request_id,
    recipient: req.recipient,
    amount_near: req.amount_near,
    amount_yocto: req.amount_yocto,
    risk_score: req.risk_score,
    authority_level: req.authority_level,
    status: req.status,
    reason: req.reason ?? null,
    tx_hash: req.tx_hash || null,
    chain_mode: req.chain_mode,
    decided_by: req.decided_by ?? null,
    chain_reason: req.chain_reason ?? null,
    policy_version: req.policy_version ?? null,
    last_synced_at: req.last_synced_at ?? null,
    created_at: req.created_at,
    expiry_ns: req.expiry_ns,
    resolved_at: req.resolved_at ?? null,
    task_evidence: req.task_evidence,
    agent: req.agent ?? null,
  };
}

function toAudit(r: Row): StoredAuditEvent {
  return {
    id: String(r.id),
    event_type: String(r.event_type),
    actor: String(r.actor),
    target_id: optStr(r.target_id),
    details: (r.details as Record<string, unknown>) ?? {},
    tx_hash: optStr(r.tx_hash),
    timestamp: num(r.timestamp),
  };
}

export class SupabaseRepository implements Repository {
  public readonly kind = 'supabase' as const;
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private fail(op: string, error: { message: string } | null): never {
    throw new Error(`Database ${op} failed: ${error?.message ?? 'unknown error'}`);
  }

  async getAgent(id: string) {
    const { data, error } = await this.db.from('agents').select('*').eq('id', id).maybeSingle();
    if (error) this.fail('getAgent', error);
    if (data) return toAgent(data);
    // First use: create the seeded agent so trust starts from a known value.
    const seed = defaultAgent();
    if (seed.id !== id) return undefined;
    await this.saveAgent(seed);
    return seed;
  }

  async listAgents() {
    const { data, error } = await this.db.from('agents').select('*').order('id');
    if (error) this.fail('listAgents', error);
    if (!data || data.length === 0) {
      const seed = await this.getAgent(defaultAgent().id);
      return seed ? [seed] : [];
    }
    return data.map(toAgent);
  }

  async saveAgent(agent: StoredAgent) {
    const { error } = await this.db.from('agents').upsert({ ...agent, updated_at: new Date().toISOString() });
    if (error) this.fail('saveAgent', error);
  }

  async listRequests(opts: ListRequestsOptions = {}) {
    let q = this.db.from('payment_requests').select('*').order('created_at', { ascending: false });
    if (opts.agentId) q = q.eq('agent_id', opts.agentId);
    if (opts.statuses) q = q.in('status', opts.statuses);
    if (opts.chainMode) q = q.eq('chain_mode', opts.chainMode);
    q = q.limit(opts.limit ?? 500);
    const { data, error } = await q;
    if (error) this.fail('listRequests', error);
    return (data ?? []).map(toRequest);
  }

  async getRequest(idOrRequestId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRequestId);
    const { data, error } = await this.db
      .from('payment_requests')
      .select('*')
      .eq(isUuid ? 'id' : 'request_id', idOrRequestId)
      .maybeSingle();
    if (error) this.fail('getRequest', error);
    return data ? toRequest(data) : undefined;
  }

  async saveRequest(req: StoredRequest) {
    const { error } = await this.db.from('payment_requests').upsert(fromRequest(req));
    if (error) this.fail('saveRequest', error);
  }

  async saveRiskEvaluation(evaluation: RiskEvaluationResult) {
    const { error } = await this.db.from('risk_evaluations').upsert({
      request_id: evaluation.request_id,
      agent_id: evaluation.agent_id,
      composite_risk: evaluation.composite_risk,
      authority_level: evaluation.authority_level,
      reasons: evaluation.reasons,
      evaluation,
      evaluated_at: evaluation.evaluated_at,
    });
    if (error) this.fail('saveRiskEvaluation', error);
  }

  async getRiskEvaluation(requestId: string) {
    const { data, error } = await this.db.from('risk_evaluations').select('evaluation').eq('request_id', requestId).maybeSingle();
    if (error) this.fail('getRiskEvaluation', error);
    return (data?.evaluation as RiskEvaluationResult | undefined) ?? undefined;
  }

  async logAudit(eventType: string, actor: string, targetId?: string, details: Record<string, unknown> = {}, txHash?: string) {
    const { error } = await this.db.from('audit_events').insert({
      event_type: eventType,
      actor,
      target_id: targetId ?? null,
      details,
      tx_hash: txHash ?? null,
      timestamp: Date.now(),
    });
    if (error) this.fail('logAudit', error);
  }

  async getAuditEvents(limit = 50) {
    const { data, error } = await this.db.from('audit_events').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (error) this.fail('getAuditEvents', error);
    return (data ?? []).map(toAudit);
  }
}
