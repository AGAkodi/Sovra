/**
 * Lapsed holds: the reconciler frees NEAR still reserved by held requests whose approval
 * window passed, using the release-only key. RPC calls are mocked; nothing is broadcast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OnchainRequest } from '../src/near/client';

const onchain = new Map<string, OnchainRequest | null>();
const releaseMock = vi.fn(async (_id: string) => ({ ok: true, tx_hash: 'releaseTx' }));
let releaserConfigured = true;

vi.mock('../src/near/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/near/client')>();
  return {
    ...actual,
    canReleaseLapsedHolds: () => releaserConfigured,
    getOnchainRequest: async (id: string) => onchain.get(id) ?? null,
    releaseLapsedHold: (id: string) => releaseMock(id),
  };
});

const { releaseLapsedHolds } = await import('../src/near/sync');
const { repo } = await import('../src/db/store');
const { MemoryRepository } = await import('../src/db/memory-repo');
import type { StoredRequest } from '../src/db/store';

const pastNs = String(BigInt(Date.now() - 60_000) * 1_000_000n);
const futureNs = String(BigInt(Date.now() + 3_600_000) * 1_000_000n);

function stored(id: string, status: StoredRequest['status'] = 'expired'): StoredRequest {
  return {
    id, vault_id: 'vault-01', agent_id: 'agent-01', request_id: `req-${id}`, recipient: 'w.testnet', amount_near: 2.5,
    amount_yocto: '2500000000000000000000000', risk_score: 33, authority_level: 5, status, chain_mode: 'testnet',
    created_at: Date.now() - 4_000_000, expiry_ns: pastNs, task_evidence: { prompt: '', evidence_hash: '', completion_summary: '' },
  };
}

function chain(id: string, status: OnchainRequest['status'], expiry_ns = pastNs): OnchainRequest {
  return { request_id: `req-${id}`, status, expiry_ns } as unknown as OnchainRequest;
}

describe('Releasing lapsed holds', () => {
  beforeEach(() => {
    (repo as InstanceType<typeof MemoryRepository>).reset();
    onchain.clear();
    releaseMock.mockClear();
    releaserConfigured = true;
  });

  it('releases a hold the app marked expired but the vault still reserves', async () => {
    await repo.saveRequest(stored('a'));
    onchain.set('req-a', chain('a', 'PendingApproval'));
    expect(await releaseLapsedHolds()).toBe(1);
    expect(releaseMock).toHaveBeenCalledWith('req-a');
    const events = await repo.getAuditEvents(10);
    expect(events.some((e) => e.event_type === 'LapsedHoldReleased' && e.target_id === 'req-a')).toBe(true);
  });

  it('leaves requests the vault already expired, and holds still inside their window', async () => {
    await repo.saveRequest(stored('b'));
    await repo.saveRequest(stored('c'));
    onchain.set('req-b', chain('b', 'Expired'));
    onchain.set('req-c', chain('c', 'PendingApproval', futureNs));
    expect(await releaseLapsedHolds()).toBe(0);
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it('does nothing without the release-only key', async () => {
    releaserConfigured = false;
    await repo.saveRequest(stored('d'));
    onchain.set('req-d', chain('d', 'PendingApproval'));
    expect(await releaseLapsedHolds()).toBe(0);
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it('logs a failed release and does not count it', async () => {
    releaseMock.mockResolvedValueOnce({ ok: false, reason: 'boom' } as never);
    await repo.saveRequest(stored('e'));
    onchain.set('req-e', chain('e', 'PendingApproval'));
    expect(await releaseLapsedHolds()).toBe(0);
    const events = await repo.getAuditEvents(10);
    expect(events.some((e) => e.event_type === 'LapsedHoldReleaseFailed')).toBe(true);
  });
});
