/**
 * Deploys and configures the Throttle vault on testnet from .env, step by step.
 * Safe to re-run: each step checks the chain first and is skipped if already done.
 * Every transaction is signed by near-cli-rs with keys from YOUR keychain.
 *
 * Run: double-click scripts/setup-vault.cmd   (or: node scripts/setup-vault.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) {
  const d = [0];
  for (const byte of buf) {
    for (let j = 0; j < d.length; j++) d[j] <<= 8;
    d[0] += byte;
    let c = 0;
    for (let j = 0; j < d.length; j++) { d[j] += c; c = (d[j] / 58) | 0; d[j] %= 58; }
    while (c) { d.push(c % 58); c = (c / 58) | 0; }
  }
  for (let i = 0; i < buf.length && buf[i] === 0; i++) d.push(0);
  return d.reverse().map((x) => B58[x]).join('');
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

// ---------- config ----------
function loadEnv() {
  const env = {};
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) fail(`.env not found in ${ROOT}`);
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function fail(msg) {
  console.error(`\n[X] ${msg}\n`);
  process.exit(1);
}

const env = loadEnv();
const need = (k) => {
  const v = env[k];
  if (!v || v.endsWith('...')) fail(`${k} missing in .env`);
  return v;
};
const network = env.NEAR_NETWORK || 'testnet';
const rpc = env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
const scale = Number(env.DEMO_SCALE || '1');
if (!(scale > 0 && scale <= 1)) fail(`DEMO_SCALE must be in (0, 1], got ${env.DEMO_SCALE}`);
const vault = need('VAULT_CONTRACT_ID');
const owner = need('OWNER_ACCOUNT_ID');
const agent = need('AGENT_ACCOUNT_ID');
const recipient = need('RECIPIENT_ACCOUNT_ID');
const signerPk = need('POLICY_SIGNER_PUBLIC_KEY');
const agentPk = need('AGENT_PUBLIC_KEY');

const yocto = (n) => (BigInt(Math.round(n * 1e6)) * 10n ** 18n).toString();
const nearStr = (n) => `${Math.round(n * 1e6) / 1e6} NEAR`;

function findWasm() {
  const candidates = [
    env.WASM_PATH,
    path.join(ROOT, 'contracts/throttle-vault/target/near/throttle_vault.wasm'),
    path.join(ROOT, 'contracts/throttle-vault/target/wasm32-unknown-unknown/release/throttle_vault.wasm'),
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) fail('No contract wasm found. Download the CI artifact "throttle_vault-wasm" and set WASM_PATH in .env.');
  return found;
}

// ---------- near-cli-rs runner (no shell, so JSON args are passed intact) ----------
function nearCommand() {
  const appdata = process.env.APPDATA || '';
  const runJs = path.join(appdata, 'npm', 'node_modules', 'near-cli-rs', 'run-near.js');
  if (fs.existsSync(runJs)) return [process.execPath, [runJs]];
  return ['near', []];
}

function near(args, label) {
  const [cmd, prefix] = nearCommand();
  console.log(`\n--> ${label}`);
  if (process.env.DRY_RUN) {
    console.log(`    [dry run] ${[cmd, ...prefix, ...args].join(' ')}`);
    return;
  }
  const res = spawnSync(cmd, [...prefix, ...args], { stdio: 'inherit' });
  if (res.status !== 0) fail(`Step failed: ${label}. See the near-cli output above.`);
}

// ---------- chain reads ----------
async function rpcQuery(params) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { finality: 'final', ...params } }),
  });
  const body = await res.json();
  if (body.error || body.result?.error) return null;
  return body.result;
}

async function view(method, args = {}) {
  const r = await rpcQuery({
    request_type: 'call_function',
    account_id: vault,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
  });
  if (!r?.result) return undefined;
  return JSON.parse(Buffer.from(r.result).toString('utf8'));
}

async function isDeployed() {
  const acct = await rpcQuery({ request_type: 'view_account', account_id: vault });
  if (!acct) fail(`Vault account ${vault} does not exist. Create the accounts first.`);
  return acct.code_hash !== '11111111111111111111111111111111';
}

async function agentKeyExists() {
  const r = await rpcQuery({ request_type: 'view_access_key', account_id: agent, public_key: agentPk });
  return !!r?.permission;
}

const call = (method, args, deposit = '0 NEAR') => [
  'contract', 'call-function', 'as-transaction', vault, method,
  'json-args', JSON.stringify(args),
  'prepaid-gas', '30.0 Tgas', 'attached-deposit', deposit,
  'sign-as', owner, 'network-config', network, 'sign-with-keychain', 'send',
];

// ---------- steps ----------
async function main() {
  const perTxCap = 30 * scale;
  const dailyBudget = 100 * scale;
  const deposit = 20 * scale;
  console.log(`Throttle vault setup on ${network}`);
  console.log(`  vault ${vault}, owner ${owner}, agent ${agent}, recipient ${recipient}`);
  console.log(`  caps: per-tx ${nearStr(perTxCap)}, daily ${nearStr(dailyBudget)} (DEMO_SCALE=${scale})`);

  // 1. Deploy + init, or upgrade code in place (state kept) if the local build differs
  if (await isDeployed()) {
    const policy = await view('get_policy');
    if (!policy) fail('Vault has code but get_policy failed; it may be an old or uninitialised contract.');
    if (policy.policy_signer_pk !== signerPk) fail(`On-chain policy signer ${policy.policy_signer_pk} does not match .env ${signerPk}.`);
    const wasm = findWasm();
    const localHash = base58(crypto.createHash('sha256').update(fs.readFileSync(wasm)).digest());
    const onchainHash = (await rpcQuery({ request_type: 'view_account', account_id: vault })).code_hash;
    if (localHash === onchainHash) {
      console.log(`\n[ok] Contract already deployed and up to date (policy v${policy.version}, chain ${policy.chain_id})`);
    } else {
      console.log(`\nLocal build differs from deployed code:\n  on-chain ${onchainHash}\n  local    ${localHash}  (${wasm})`);
      near(
        ['contract', 'deploy', vault, 'use-file', wasm, 'without-init-call',
          'network-config', network, 'sign-with-keychain', 'send'],
        'Upgrade vault code in place (no re-init; state is kept)'
      );
      const after = await view('get_policy');
      if (!after || after.version !== policy.version) fail('Upgrade finished but state check failed; tell Claude.');
      console.log(`[ok] Upgraded; state intact (policy v${after.version})`);
    }
  } else {
    const wasm = findWasm();
    console.log(`\nUsing wasm: ${wasm} (${fs.statSync(wasm).size} bytes)`);
    const init = {
      owner_id: owner,
      chain_id: network,
      policy_signer_pk: signerPk,
      per_tx_cap: yocto(perTxCap),
      daily_budget: yocto(dailyBudget),
      require_whitelist: true,
    };
    near(
      ['contract', 'deploy', vault, 'use-file', wasm, 'with-init-call', 'new', 'json-args', JSON.stringify(init),
        'prepaid-gas', '100.0 Tgas', 'attached-deposit', '0 NEAR', 'network-config', network, 'sign-with-keychain', 'send'],
      'Deploy and initialise vault (signed by the vault account)'
    );
  }

  // 2. Approve agent
  if (await view('is_agent_approved', { agent_id: agent })) console.log(`\n[ok] Agent ${agent} already approved`);
  else near(call('set_agent', { agent_id: agent, approved: true }), `Approve agent ${agent} (signed by owner)`);

  // 3. Whitelist recipient
  if (await view('is_recipient_allowed', { recipient })) console.log(`\n[ok] Recipient ${recipient} already whitelisted`);
  else near(call('set_recipient', { recipient, allowed: true }), `Whitelist recipient ${recipient} (signed by owner)`);

  // 4. Owner deposit (demo step 1)
  const events = (await view('get_recent_events', { limit: 200 })) || [];
  if (events.some((e) => e.event_type === 'DepositReceived')) console.log('\n[ok] Owner deposit already made');
  else near(call('deposit', {}, nearStr(deposit)), `Owner deposits ${nearStr(deposit)} into the vault`);

  // 5. Restricted agent key
  if (await agentKeyExists()) console.log('\n[ok] Restricted agent key already added');
  else
    near(
      ['account', 'add-key', agent, 'grant-function-call-access', '--allowance', '1 NEAR',
        '--contract-account-id', vault, '--function-names', 'request_payment',
        'use-manually-provided-public-key', agentPk, 'network-config', network, 'sign-with-keychain', 'send'],
      'Add restricted agent key (request_payment on the vault only)'
    );

  // 6. Verify
  const status = await view('get_vault_status');
  const key = await rpcQuery({ request_type: 'view_access_key', account_id: agent, public_key: agentPk });
  console.log('\n================ RESULT ================');
  console.log(`Owner:            ${status?.owner_id}`);
  console.log(`Frozen:           ${status?.is_frozen}`);
  console.log(`Policy version:   ${status?.policy?.version}`);
  console.log(`Signer key:       ${status?.policy?.policy_signer_pk}`);
  console.log(`Available:        ${status ? Number(BigInt(status.available_balance) / 10n ** 21n) / 1000 : '?'} NEAR`);
  console.log(`Whitelist:        ${JSON.stringify(await view('get_allowed_recipients'))}`);
  console.log(`Agent key scope:  ${JSON.stringify(key?.permission)}`);
  console.log('\nVault is ready. Close this window and tell Claude.');
}

main().catch((e) => fail(e.stack || String(e)));
