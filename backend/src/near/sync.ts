/**
 * Mirrors on-chain vault state into the local store and reconciles open requests.
 * Only used in testnet mode; reads are safe to repeat and never re-broadcast anything.
 */
import { repo, store, StoredRequest, StoredVault } from '../db/store';
import { applyTrustOutcome } from '../agent/trust';
import {
  canReleaseLapsedHolds,
  getAllowedRecipients,
  getNearConfig,
  getOnchainRequest,
  getVaultStatus,
  OnchainRequest,
  releaseLapsedHold,
  yoctoToNear,
} from './client';

export function mapOnchainStatus(req: OnchainRequest, nowMs: number = Date.now()): StoredRequest['status'] {
  switch (req.status) {
    case 'PendingApproval':
      return BigInt(req.expiry_ns) < BigInt(nowMs) * 1_000_000n ? 'expired' : 'pending_approval';
    case 'Approved':
    case 'Executing':
      return 'executing';
    case 'Succeeded':
      return 'succeeded';
    case 'Failed':
      return 'failed';
    case 'Rejected':
      return 'rejected';
    case 'Expired':
      return 'expired';
  }
}

export async function syncVaultFromChain(vaultId: string): Promise<StoredVault> {
  const vault = store.getVault(vaultId);
  if (!vault) throw new Error(`Vault ${vaultId} not found`);
  const status = await getVaultStatus();
  try {
    vault.allowed_recipients = await getAllowedRecipients();
  } catch {
    // Keep the last known whitelist; the vault still enforces its own.
  }

  vault.contract_id = getNearConfig().vaultContractId;
  vault.owner_id = status.owner_id;
  vault.network = status.policy.chain_id;
  vault.is_frozen = status.is_frozen;
  vault.policy_version = status.policy.version;
  vault.per_tx_cap_near = yoctoToNear(status.policy.per_tx_cap);
  vault.daily_budget_near = yoctoToNear(status.policy.daily_budget);
  vault.require_whitelist = status.policy.require_whitelist;
  vault.max_risk_for_autonomous = status.policy.max_risk_for_autonomous;
  vault.policy_signer_pk = status.policy.policy_signer_pk ?? '';
  vault.vault_balance_near = yoctoToNear(status.vault_balance);
  vault.reserved_balance_near = yoctoToNear(status.reserved_balance);
  vault.available_balance_near = yoctoToNear(status.available_balance);
  vault.storage_reserve_near = yoctoToNear(status.storage_reserve);
  vault.daily_spent_near = yoctoToNear(status.daily_spent);
  vault.last_synced_at = Date.now();
  store.vaults.set(vault.id, vault);
  return vault;
}

/** Re-reads every open testnet request from the vault and updates its local status. */
export async function reconcileOpenRequests(): Promise<number> {
  const open = await repo.listRequests({ chainMode: 'testnet', statuses: ['pending_approval', 'executing'], limit: 25 });
  let changed = 0;
  for (const req of open) {
    changed += (await reconcileRequest(req)) ? 1 : 0;
  }
  await releaseLapsedHolds();
  return changed;
}

/** Requests already released (or found not pending) by this instance; avoids paying gas twice. */
const settledHolds = new Set<string>();

/**
 * Frees the NEAR still reserved by held requests whose approval window lapsed. The app
 * marks them expired, but the vault keeps the reservation until someone calls
 * expire_request. Needs the release-only key; without it the owner clicks Release.
 */
export async function releaseLapsedHolds(): Promise<number> {
  if (!canReleaseLapsedHolds()) return 0;
  const lapsed = await repo.listRequests({ chainMode: 'testnet', statuses: ['expired'], limit: 25 });
  let released = 0;
  for (const req of lapsed) {
    if (settledHolds.has(req.request_id)) continue;
    const onchain = await getOnchainRequest(req.request_id).catch(() => null);
    const lapsedOnChain =
      onchain?.status === 'PendingApproval' && BigInt(onchain.expiry_ns) < BigInt(Date.now()) * 1_000_000n;
    if (!lapsedOnChain) {
      if (onchain) settledHolds.add(req.request_id);
      continue;
    }
    const result = await releaseLapsedHold(req.request_id);
    if (result.ok) {
      settledHolds.add(req.request_id);
      released += 1;
    }
    await repo.logAudit(
      result.ok ? 'LapsedHoldReleased' : 'LapsedHoldReleaseFailed',
      'reconciler',
      req.request_id,
      { amount: req.amount_near, recipient: req.recipient, chain_mode: 'testnet', reason: result.reason },
      result.tx_hash
    );
  }
  return released;
}

export async function reconcileRequest(req: StoredRequest): Promise<boolean> {
  const onchain = await getOnchainRequest(req.request_id);
  req.last_synced_at = Date.now();
  if (!onchain) {
    await repo.saveRequest(req);
    return false;
  }
  if (onchain.status === 'PendingApproval') req.expiry_ns = onchain.expiry_ns;
  const next = mapOnchainStatus(onchain);
  if (next === req.status) {
    await repo.saveRequest(req);
    return false;
  }
  const previous = req.status;
  req.status = next;
  if (onchain.failure_reason) req.chain_reason = onchain.failure_reason;
  if (previous === 'pending_approval' && next !== 'expired') req.decided_by = 'owner';
  if (onchain.resolved_at_ns) req.resolved_at = Number(BigInt(onchain.resolved_at_ns) / 1_000_000n);
  await repo.saveRequest(req);
  await repo.logAudit('RequestReconciledFromChain', 'reconciler', req.request_id, {
    from: previous,
    to: next,
    onchain_status: onchain.status,
    failure_reason: onchain.failure_reason,
  });
  await applyTrustOutcome(req);
  return true;
}
