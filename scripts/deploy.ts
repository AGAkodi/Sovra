/**
 * Throttle for NEAR: testnet deployment helper.
 *
 * Prints the exact near-cli-rs commands to deploy and configure the vault from your
 * .env values. It does not run them: each one is signed with your own keychain.
 * Check flags against `near --help` for your near-cli-rs version before running.
 *
 * Usage (from repo root): npx ts-node scripts/deploy.ts
 */
import * as fs from 'fs';
import * as path from 'path';

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.endsWith('...')) {
    console.error(`Missing ${name} in .env (run 'npm --prefix backend run keygen' for keys).`);
    process.exit(1);
  }
  return v;
}

const YOCTO_PER_NEAR = 10n ** 24n;
const near = (n: number) => (BigInt(n) * YOCTO_PER_NEAR).toString();

function main() {
  loadDotEnv();
  const wasmPath = path.resolve(__dirname, '../contracts/throttle-vault/target/wasm32-unknown-unknown/release/throttle_vault.wasm');
  if (!fs.existsSync(wasmPath)) {
    console.error(`WASM not found at ${wasmPath}. Run 'npm run build:contract' first.`);
    process.exit(1);
  }

  const network = process.env.NEAR_NETWORK || 'testnet';
  const vault = required('VAULT_CONTRACT_ID');
  const owner = required('OWNER_ACCOUNT_ID');
  const agent = required('AGENT_ACCOUNT_ID');
  const recipient = required('RECIPIENT_ACCOUNT_ID');
  const signerPk = required('POLICY_SIGNER_PUBLIC_KEY');
  const agentPk = required('AGENT_PUBLIC_KEY');

  const initArgs = JSON.stringify({
    owner_id: owner,
    chain_id: network,
    policy_signer_pk: signerPk,
    per_tx_cap: near(30),
    daily_budget: near(100),
    require_whitelist: true,
  });

  const call = (method: string, args: object, deposit = '0 NEAR') =>
    `near contract call-function as-transaction ${vault} ${method} json-args '${JSON.stringify(args)}' ` +
    `prepaid-gas '30.0 Tgas' attached-deposit '${deposit}' sign-as ${owner} network-config ${network} sign-with-keychain send`;

  console.log(`# Throttle vault deployment (${network})`);
  console.log(`# WASM: ${wasmPath} (${fs.statSync(wasmPath).size} bytes)\n`);

  console.log('# 1. Deploy and initialise (vault account must exist and be funded for storage)');
  console.log(
    `near contract deploy ${vault} use-file "${wasmPath}" with-init-call new json-args '${initArgs}' ` +
      `prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config ${network} sign-with-keychain send\n`
  );

  console.log('# 2. Approve the agent account and whitelist the known recipient');
  console.log(call('set_agent', { agent_id: agent, approved: true }));
  console.log(call('set_recipient', { recipient, allowed: true }) + '\n');

  console.log('# 3. Fund the vault with testnet NEAR (keep amounts small)');
  console.log(call('deposit', {}, '40 NEAR') + '\n');

  console.log('# 4. Give the agent a function-call key restricted to request_payment on the vault.');
  console.log('#    Each request prepays 60 TGas (~0.006 NEAR) from the allowance; 1 NEAR covers ~150 requests.');
  console.log(
    `near account add-key ${agent} grant-function-call-access --allowance '1 NEAR' ` +
      `--contract-account-id ${vault} --function-names 'request_payment' ` +
      `use-manually-provided-public-key ${agentPk} network-config ${network} sign-with-keychain send\n`
  );

  console.log('# 5. Verify');
  console.log(`near contract call-function as-read-only ${vault} get_vault_status json-args '{}' network-config ${network} now`);
}

main();
