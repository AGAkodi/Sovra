import { describe, it, expect } from 'vitest';
import { MemoryRepository } from '../src/db/memory-repo';
import type { StoredRequest } from '../src/db/store';

function req(id: string, created: number, status: StoredRequest['status'] = 'succeeded', agent = 'agent-01'): StoredRequest {
  return {
    id, vault_id: 'vault-01', agent_id: agent, request_id: `req-${id}`, recipient: 'w.testnet', amount_near: 1,
    amount_yocto: '1', risk_score: 1, authority_level: 1, status, chain_mode: 'testnet', created_at: created,
    expiry_ns: '0', task_evidence: { prompt: '', evidence_hash: '', completion_summary: '' },
  };
}

describe('Repository contract (memory implementation)', () => {
  it('seeds the default agent and persists trust updates', async () => {
    const r = new MemoryRepository();
    const a = (await r.getAgent('agent-01'))!;
    expect(a.trust_score).toBe(82.5);
    await r.saveAgent({ ...a, trust_score: 40 });
    expect((await r.getAgent('agent-01'))!.trust_score).toBe(40);
  });

  it('returns copies, so callers cannot mutate stored state by accident', async () => {
    const r = new MemoryRepository();
    await r.saveRequest(req('a', 1));
    const got = (await r.getRequest('a'))!;
    got.status = 'failed';
    expect((await r.getRequest('a'))!.status).toBe('succeeded');
  });

  it('lists newest first with filters and finds by either id', async () => {
    const r = new MemoryRepository();
    await r.saveRequest(req('a', 1, 'succeeded'));
    await r.saveRequest(req('b', 3, 'pending_approval'));
    await r.saveRequest(req('c', 2, 'executing', 'other'));
    expect((await r.listRequests()).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect((await r.listRequests({ statuses: ['pending_approval', 'executing'] })).map((x) => x.id)).toEqual(['b', 'c']);
    expect((await r.listRequests({ agentId: 'agent-01' })).map((x) => x.id)).toEqual(['b', 'a']);
    expect((await r.listRequests({ limit: 1 })).map((x) => x.id)).toEqual(['b']);
    expect((await r.getRequest('req-c'))!.id).toBe('c');
  });

  it('audit log is newest first', async () => {
    const r = new MemoryRepository();
    await r.logAudit('A', 'x');
    await r.logAudit('B', 'x');
    expect((await r.getAuditEvents(2)).map((e) => e.event_type)).toEqual(['B', 'A']);
  });
});
