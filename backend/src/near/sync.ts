/**
 * Mirrors on-chain vault state into the local store and reconciles open requests.
 * Only used in testnet mode; reads are safe to repeat and never re-broadcast anything.
 */
import { store, StoredRequest, StoredVault } from '../db/store';
import { getAllowedRecipients, getNearConfig, getOnchainRequest, getVaultStatus, OnchainRequest, yoctoToNear } from './client';

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
  vault.daily_spent_near = yoctoToNear(status.daily_spent);
  vault.last_synced_at = Date.now();
  store.vaults.set(vault.id, vault);
  return vault;
}

/** Re-reads every open testnet request from the vault and updates its local status. */
export async function reconcileOpenRequests(): Promise<number> {
  const open = store
    .listRequests()
    .filter((r) => r.chain_mode === 'testnet' && (r.status === 'pending_approval' || r.status === 'executing'));
  let changed = 0;
  for (const req of open) {
    changed += (await reconcileRequest(req)) ? 1 : 0;
  }
  return changed;
}

export async function reconcileRequest(req: StoredRequest): Promise<boolean> {
  const onchain = await getOnchainRequest(req.request_id);
  req.last_synced_at = Date.now();
  if (!onchain) {
    store.saveRequest(req);
    return false;
  }
  const next = mapOnchainStatus(onchain);
  if (next === req.status) {
    store.saveRequest(req);
    return false;
  }
  const previous = req.status;
  req.status = next;
  if (onchain.failure_reason) req.chain_reason = onchain.failure_reason;
  if (previous === 'pending_approval' && next !== 'expired') req.decided_by = 'owner';
  if (onchain.resolved_at_ns) req.resolved_at = Number(BigInt(onchain.resolved_at_ns) / 1_000_000n);
  store.saveRequest(req);
  store.logAudit('RequestReconciledFromChain', 'reconciler', req.request_id, {
    from: previous,
    to: next,
    onchain_status: onchain.status,
    failure_reason: onchain.failure_reason,
  });
  return true;
}
