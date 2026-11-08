/**
 * NEAR client for Throttle vault interactions.
 *
 * Two modes:
 *  - 'testnet': VAULT_CONTRACT_ID, AGENT_ACCOUNT_ID and AGENT_PRIVATE_KEY are set.
 *    Every payment request is broadcast to the vault and its on-chain result is read back.
 *  - 'simulation': credentials are missing or NEAR_MODE=simulation. Nothing is broadcast;
 *    callers must label results as simulated and never present them as chain confirmations.
 *
 * Env vars are read lazily so they are picked up after config.ts loads .env files.
 */
import * as nearAPI from 'near-api-js';
import { KeyPair, providers, transactions } from 'near-api-js';

export type ChainMode = 'testnet' | 'simulation';

/** 60 TGas: request_payment + transfer action + 20 TGas callback, with headroom. */
const REQUEST_PAYMENT_GAS = 60_000_000_000_000n;

interface NearConfig {
  networkId: string;
  rpcUrl: string;
  vaultContractId: string;
  agentAccountId: string;
  agentPrivateKey: string;
}

function isSet(value: string | undefined): value is string {
  return !!value && !value.trim().endsWith('...');
}

export function getNearConfig(): NearConfig {
  return {
    networkId: process.env.NEAR_NETWORK || 'testnet',
    rpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
    vaultContractId: process.env.VAULT_CONTRACT_ID || '',
    agentAccountId: process.env.AGENT_ACCOUNT_ID || '',
    agentPrivateKey: process.env.AGENT_PRIVATE_KEY || '',
  };
}

export function getChainMode(): ChainMode {
  if (process.env.NEAR_MODE === 'simulation') return 'simulation';
  const cfg = getNearConfig();
  const configured = isSet(cfg.vaultContractId) && isSet(cfg.agentAccountId) && isSet(cfg.agentPrivateKey);
  if (configured) return 'testnet';
  if (process.env.NEAR_MODE === 'testnet') {
    throw new Error('NEAR_MODE=testnet but VAULT_CONTRACT_ID, AGENT_ACCOUNT_ID or AGENT_PRIVATE_KEY is missing.');
  }
  return 'simulation';
}

export class ChainUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainUnavailableError';
  }
}

// ---------- Contract types (mirror contracts/throttle-vault/src/lib.rs) ----------

export type OnchainRequestStatus = 'PendingApproval' | 'Approved' | 'Executing' | 'Succeeded' | 'Failed' | 'Rejected';

export interface OnchainRequest {
  request_id: string;
  agent_id: string;
  recipient: string;
  amount: string; // yoctoNEAR
  risk_score: number;
  authority_level: string;
  policy_version: number;
  status: OnchainRequestStatus;
  created_at_ns: string;
  expiry_ns: string;
  resolved_at_ns: string | null;
  failure_reason: string | null;
}

export interface OnchainPolicy {
  version: number;
  per_tx_cap: string;
  daily_budget: string;
  require_whitelist: boolean;
  max_risk_for_autonomous: number;
  policy_signer_pk: string | null;
  chain_id: string;
}

export interface OnchainVaultStatus {
  owner_id: string;
  is_frozen: boolean;
  policy: OnchainPolicy;
  vault_balance: string;
  storage_reserve: string;
  reserved_balance: string;
  available_balance: string;
  daily_spent: string;
  daily_remaining: string;
  approved_agents_count: number;
  total_requests_count: number;
}

type RequestOutcome =
  | { Executing: { request_id: string } }
  | { HeldForApproval: { request_id: string; reason: string } }
  | { Rejected: { request_id: string; reason: string } };

export interface RequestPaymentArgs {
  request_id: string;
  recipient: string;
  amount_yocto: string;
  expiry_ns: string;
  policy_version: number;
  risk_score: number;
  authority_level: number;
  signature_hex: string;
}

export type SubmissionOutcome =
  | 'executing' // vault dispatched the transfer (see onchain_request for final status)
  | 'held' // vault stored the request as PendingApproval
  | 'rejected' // vault recorded the request as Rejected (cap / level 6)
  | 'refused' // vault panicked (frozen, bad signature, stale policy...) — tx exists, nothing stored
  | 'rpc_error'; // could not reach the chain; outcome unknown, nothing assumed

export interface ChainSubmission {
  outcome: SubmissionOutcome;
  tx_hash?: string;
  reason?: string;
  onchain_request?: OnchainRequest | null;
}

// ---------- Helpers ----------

export function yoctoToNear(yocto: string): number {
  // Keep 6 decimal places; plenty for display and avoids float overflow.
  return Number(BigInt(yocto) / 10n ** 18n) / 1e6;
}

function provider(): providers.JsonRpcProvider {
  return new providers.JsonRpcProvider({ url: getNearConfig().rpcUrl });
}

async function viewFunction<T>(methodName: string, args: object = {}): Promise<T> {
  const cfg = getNearConfig();
  const result = await provider().query({
    request_type: 'call_function',
    finality: 'optimistic',
    account_id: cfg.vaultContractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
  });
  const bytes = (result as unknown as { result: number[] }).result;
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
}

async function getAgentAccount(): Promise<nearAPI.Account> {
  const cfg = getNearConfig();
  const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  await keyStore.setKey(cfg.networkId, cfg.agentAccountId, KeyPair.fromString(cfg.agentPrivateKey as Parameters<typeof KeyPair.fromString>[0]));
  const near = await nearAPI.connect({ networkId: cfg.networkId, keyStore, nodeUrl: cfg.rpcUrl });
  return near.account(cfg.agentAccountId);
}

/** Pulls the human-readable panic message out of a NEAR Failure status. */
function extractFailureMessage(failure: unknown): string {
  const text = JSON.stringify(failure);
  const panic = text.match(/Smart contract panicked: ([^"\\]+)/);
  if (panic) return panic[1];
  const exec = text.match(/"ExecutionError":"([^"]+)"/);
  return exec ? exec[1] : text;
}

// ---------- Public API ----------

export async function getVaultStatus(): Promise<OnchainVaultStatus> {
  try {
    return await viewFunction<OnchainVaultStatus>('get_vault_status');
  } catch (err) {
    throw new ChainUnavailableError(`Could not read vault status: ${(err as Error).message}`);
  }
}

export async function getOnchainRequest(requestId: string): Promise<OnchainRequest | null> {
  return viewFunction<OnchainRequest | null>('get_request', { request_id: requestId });
}

/**
 * Broadcasts request_payment with the agent's function-call key and reports what the
 * vault actually did. Never retries the broadcast (a retry could double-submit);
 * only the follow-up read is safe to repeat.
 */
export async function submitPaymentRequest(args: RequestPaymentArgs): Promise<ChainSubmission> {
  const cfg = getNearConfig();
  let result: providers.FinalExecutionOutcome;
  try {
    const account = await getAgentAccount();
    result = await account.signAndSendTransaction({
      receiverId: cfg.vaultContractId,
      actions: [
        transactions.functionCall(
          'request_payment',
          {
            recipient: args.recipient,
            amount: args.amount_yocto,
            request_id: args.request_id,
            expiry_ns: args.expiry_ns,
            policy_version: args.policy_version,
            risk_score: args.risk_score,
            authority_level_u8: args.authority_level,
            signature_hex: args.signature_hex,
          },
          REQUEST_PAYMENT_GAS,
          0n // function-call access keys cannot attach deposits
        ),
      ],
      returnError: true,
    });
  } catch (err) {
    const e = err as Error & { context?: { transactionHash?: string } };
    return { outcome: 'rpc_error', tx_hash: e.context?.transactionHash, reason: e.message };
  }

  const txHash = result.transaction_outcome.id;
  const status = result.status as { Failure?: unknown };
  if (status && typeof status === 'object' && status.Failure) {
    return { outcome: 'refused', tx_hash: txHash, reason: extractFailureMessage(status.Failure) };
  }

  const outcome = providers.getTransactionLastResult(result) as RequestOutcome;
  let onchain: OnchainRequest | null = null;
  try {
    onchain = await getOnchainRequest(args.request_id);
  } catch {
    onchain = null; // reconciliation will pick it up later
  }

  if ('Executing' in outcome) return { outcome: 'executing', tx_hash: txHash, onchain_request: onchain };
  if ('HeldForApproval' in outcome) {
    return { outcome: 'held', tx_hash: txHash, reason: outcome.HeldForApproval.reason, onchain_request: onchain };
  }
  return { outcome: 'rejected', tx_hash: txHash, reason: outcome.Rejected.reason, onchain_request: onchain };
}

export function explorerTxUrl(txHash: string): string {
  const network = getNearConfig().networkId;
  return network === 'mainnet' ? `https://nearblocks.io/txns/${txHash}` : `https://testnet.nearblocks.io/txns/${txHash}`;
}
