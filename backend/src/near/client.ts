/**
 * NEAR API JS client wrapper for Throttle vault interactions.
 *
 * When AGENT_PRIVATE_KEY and VAULT_CONTRACT_ID env vars are set, this module
 * executes real NEAR testnet transactions. Otherwise it emits clearly-labelled
 * SIMULATION_MODE results so the demo can proceed without credentials.
 *
 * IMPORTANT: Never simulate a successful blockchain result without clearly marking it.
 */
import * as nearAPI from 'near-api-js';
import { KeyPair, utils } from 'near-api-js';

export interface NearCallResult {
  tx_hash: string;
  success: boolean;
  error?: string;
  mode: 'REAL_TESTNET' | 'SIMULATION_MODE';
}

export interface RequestPaymentArgs {
  request_id: string;
  recipient: string;
  amount: string; // yoctoNEAR as string
  attestation_signature?: string; // hex-encoded
  expiry_ns: string;
  evidence_hash: string;
  policy_version: number;
}

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const VAULT_CONTRACT_ID = process.env.VAULT_CONTRACT_ID || '';
const AGENT_ACCOUNT_ID = process.env.AGENT_ACCOUNT_ID || '';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '';
const NETWORK_ID = process.env.NEAR_NETWORK || 'testnet';

export function isRealNearConfigured(): boolean {
  return !!(VAULT_CONTRACT_ID && AGENT_ACCOUNT_ID && AGENT_PRIVATE_KEY);
}

/**
 * Returns a NEAR connection and account pre-loaded with the agent's key.
 * Throws if credentials are not set (call isRealNearConfigured() first).
 */
async function getNearAccount(): Promise<nearAPI.Account> {
  const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(AGENT_PRIVATE_KEY as nearAPI.KeyPairString);
  await keyStore.setKey(NETWORK_ID, AGENT_ACCOUNT_ID, keyPair);

  const config = {
    networkId: NETWORK_ID,
    keyStore,
    nodeUrl: NEAR_RPC_URL,
    walletUrl: `https://wallet.${NETWORK_ID}.near.org`,
    helperUrl: `https://helper.${NETWORK_ID}.near.org`,
  };

  const near = await nearAPI.connect(config);
  return near.account(AGENT_ACCOUNT_ID);
}

/**
 * Call request_payment on the vault contract.
 * Returns a NearCallResult with the real tx hash or SIMULATION_MODE flag.
 */
export async function callRequestPayment(args: RequestPaymentArgs): Promise<NearCallResult> {
  if (!isRealNearConfigured()) {
    // SIMULATION_MODE — no real blockchain calls
    const fakeHash = `sim-${args.request_id}-${Date.now().toString(36)}`;
    console.warn(
      `[NEAR Client] SIMULATION_MODE — no AGENT_PRIVATE_KEY set.\n` +
      `  Fake tx hash: ${fakeHash}\n` +
      `  Set AGENT_PRIVATE_KEY, AGENT_ACCOUNT_ID, VAULT_CONTRACT_ID to use real testnet.`
    );
    return {
      tx_hash: fakeHash,
      success: true,
      mode: 'SIMULATION_MODE',
    };
  }

  try {
    const account = await getNearAccount();

    // 30 TGas for request_payment
    const GAS = '30000000000000';
    // No attached deposit — vault is pre-funded by owner
    const DEPOSIT = '1'; // 1 yoctoNEAR to satisfy payable guard if any

    const result = await account.functionCall({
      contractId: VAULT_CONTRACT_ID,
      methodName: 'request_payment',
      args: {
        request_id: args.request_id,
        recipient: args.recipient,
        amount: args.amount,
        attestation_signature: args.attestation_signature || null,
        expiry_ns: args.expiry_ns,
        evidence_hash: args.evidence_hash,
        policy_version: args.policy_version,
      },
      gas: BigInt(GAS),
      attachedDeposit: BigInt(DEPOSIT),
    });

    // near-api-js returns a FinalExecutionOutcome
    const txHash = result.transaction.hash;
    const status = result.status;

    const isSuccess =
      status !== null &&
      typeof status === 'object' &&
      'SuccessValue' in status;

    console.log(`[NEAR Client] request_payment tx: ${txHash} success=${isSuccess}`);

    return {
      tx_hash: txHash,
      success: isSuccess,
      mode: 'REAL_TESTNET',
      error: isSuccess ? undefined : JSON.stringify(status),
    };
  } catch (err) {
    const error = (err as Error).message;
    console.error('[NEAR Client] request_payment failed:', error);
    return {
      tx_hash: '',
      success: false,
      error,
      mode: 'REAL_TESTNET',
    };
  }
}

/**
 * View call — read vault state from chain.
 * Uses public RPC, no signing needed.
 */
export async function viewVaultState(contractId: string = VAULT_CONTRACT_ID): Promise<Record<string, unknown> | null> {
  if (!contractId) return null;
  try {
    const provider = new nearAPI.providers.JsonRpcProvider({ url: NEAR_RPC_URL });
    const result = await provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: 'get_policy',
      args_base64: btoa('{}'),
    });

    if ('result' in result) {
      const bytes = (result as { result: number[] }).result;
      const decoded = Buffer.from(bytes).toString('utf8');
      return JSON.parse(decoded);
    }
    return null;
  } catch (err) {
    console.warn('[NEAR Client] viewVaultState failed:', (err as Error).message);
    return null;
  }
}

/**
 * View call — check if a request_id has been executed on-chain already.
 */
export async function checkRequestExists(requestId: string, contractId: string = VAULT_CONTRACT_ID): Promise<boolean> {
  if (!contractId) return false;
  try {
    const provider = new nearAPI.providers.JsonRpcProvider({ url: NEAR_RPC_URL });
    const args = JSON.stringify({ request_id: requestId });
    const result = await provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: 'get_request',
      args_base64: Buffer.from(args).toString('base64'),
    });

    if ('result' in result) {
      const bytes = (result as { result: number[] }).result;
      const decoded = Buffer.from(bytes).toString('utf8');
      return decoded !== 'null';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Deposit NEAR into vault (called by owner, not agent).
 * This is owner-only; the agent key cannot do this.
 */
export async function getAccountBalance(accountId: string): Promise<string> {
  try {
    const provider = new nearAPI.providers.JsonRpcProvider({ url: NEAR_RPC_URL });
    const account = await provider.query({
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId,
    });
    if ('amount' in account) {
      const yocto = (account as { amount: string }).amount;
      const near = Number(BigInt(yocto) / 10n ** 21n) / 1000;
      return `${near.toFixed(3)} NEAR`;
    }
    return '0 NEAR';
  } catch {
    return 'unknown';
  }
}

