/**
 * Throttle for NEAR: testnet deployment helper.
 *
 * Prints the exact near-cli-rs commands to create accounts, deploy and configure the
 * vault from your .env values. It runs nothing: every command signs with your own
 * keychain, so you run them yourself. See docs/TESTNET_SETUP.md for the walkthrough.
 *
 * Usage (from repo root): npx --prefix backend ts-node scripts/deploy.ts
 */
import * as fs from 'fs';
import * as path from 'path';

/** Directory of this script; works whether Node runs it as CommonJS or ESM. */
const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1]));

function loadDotEnv() {
  const envPath = path.resolve(SCRIPT_DIR, '../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.endsWith('...')) {
    console.error(`Missing ${name} in .env (see docs/TESTNET_SETUP.md).`);
    process.exit(1);
  }
  return v;
}

/** Mirrors backend/src/demo.ts so on-chain caps match the backend's scenarios. */
function demoScale(): number {
  const s = Number(process.env.DEMO_SCALE || '1');
  if (!Number.isFinite(s) || s <= 0 || s > 1) {
    console.error(`DEMO_SCALE must be in (0, 1], got '${process.env.DEMO_SCALE}'`);
    process.exit(1);
  }
  return s;
}

const yocto = (near: number) => (BigInt(Math.round(near * 1e6)) * 10n ** 18n).toString();
const fmt = (near: number) => `${Math.round(near * 1e6) / 1e6} NEAR`;

function findWasm(): string {
  const candidates = [
    process.env.WASM_PATH,
    path.resolve(SCRIPT_DIR, '../contracts/throttle-vault/target/near/throttle_vault.wasm'), // cargo near build / CI artifact
    path.resolve(SCRIPT_DIR, '../contracts/throttle-vault/target/wasm32-unknown-unknown/release/throttle_vault.wasm'),
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    console.error('No wasm found. Download the "throttle_vault-wasm" artifact from the latest CI run');
    console.error('and set WASM_PATH, or run `npm run build:contract`.');
    process.exit(1);
  }
  return found;
}

function main() {
  loadDotEnv();
  const scale = demoScale();
  const network = process.env.NEAR_NETWORK || 'testnet';
  const vault = required('VAULT_CONTRACT_ID');
  const owner = required('OWNER_ACCOUNT_ID');
  const agent = required('AGENT_ACCOUNT_ID');
  const recipient = required('RECIPIENT_ACCOUNT_ID');
  const attacker = required('ATTACKER_ACCOUNT_ID');
  const signerPk = required('POLICY_SIGNER_PUBLIC_KEY');
  const agentPk = required('AGENT_PUBLIC_KEY');
  const wasmPath = findWasm();

  const perTxCap = 30 * scale;
  const dailyBudget = 100 * scale;
  const ownerDeposit = 20 * scale;

  const initArgs = JSON.stringify({
    owner_id: owner,
    chain_id: network,
    policy_signer_pk: signerPk,
    per_tx_cap: yocto(perTxCap),
    daily_budget: yocto(dailyBudget),
    require_whitelist: true,
  });

  const ownerCall = (method: string, args: object, deposit = '0 NEAR') =>
    `near contract call-function as-transaction ${vault} ${method} json-args '${JSON.stringify(args)}' ` +
    `prepaid-gas '30.0 Tgas' attached-deposit '${deposit}' sign-as ${owner} network-config ${network} sign-with-keychain send`;

  console.log(`# Throttle vault setup on ${network}  (DEMO_SCALE=${scale})`);
  console.log(`# Caps: per-tx ${fmt(perTxCap)}, daily ${fmt(dailyBudget)}`);
  console.log(`# Scenarios: routine ${fmt(3 * scale)}, spike ${fmt(25 * scale)}, injection ${fmt(80 * scale)}`);
  console.log(`# WASM: ${wasmPath} (${fs.statSync(wasmPath).size} bytes)\n`);

  console.log('# 1. Create accounts (faucet-funded; keys saved to your keychain)');
  for (const id of [owner, vault, agent, recipient, attacker]) {
    console.log(`near account create-account sponsor-by-faucet-service ${id} autogenerate-new-keypair save-to-keychain network-config ${network} create`);
  }
  console.log('');

  console.log('# 2. Deploy and initialise the vault (signed by the vault account itself)');
  console.log(
    `near contract deploy ${vault} use-file "${wasmPath}" with-init-call new json-args '${initArgs}' ` +
      `prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config ${network} sign-with-keychain send\n`
  );

  console.log('# 3. Owner: approve the agent and whitelist the known recipient (attacker stays off the list)');
  console.log(ownerCall('set_agent', { agent_id: agent, approved: true }));
  console.log(ownerCall('set_recipient', { recipient, allowed: true }) + '\n');

  console.log('# 4. Owner funds the vault (demo step 1)');
  console.log(ownerCall('deposit', {}, fmt(ownerDeposit)) + '\n');

  console.log('# 5. Restricted agent key: may only call request_payment on the vault, cannot move funds itself.');
  console.log('#    Each request prepays 60 TGas (~0.006 NEAR) from the allowance; 1 NEAR covers ~150 requests.');
  console.log(
    `near account add-key ${agent} grant-function-call-access --allowance '1 NEAR' ` +
      `--contract-account-id ${vault} --function-names 'request_payment' ` +
      `use-manually-provided-public-key ${agentPk} network-config ${network} sign-with-keychain send\n`
  );

  console.log('# 6. Verify');
  console.log(`near contract call-function as-read-only ${vault} get_vault_status json-args '{}' network-config ${network} now`);
  console.log(`near contract call-function as-read-only ${vault} get_allowed_recipients json-args '{}' network-config ${network} now`);
  console.log(`near account list-keys ${agent} network-config ${network} now`);
}

main();
