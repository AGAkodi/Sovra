/**
 * Owner actions on the Throttle vault, signed with the owner key in YOUR keychain.
 * Stopgap until the wallet UI lands, and a fallback for the demo.
 *
 *   node scripts/owner.mjs approve     approve the most recent held request
 *   node scripts/owner.mjs reject      reject the most recent held request
 *   node scripts/owner.mjs freeze
 *   node scripts/owner.mjs unfreeze
 *
 * approve/reject show the request and ask for confirmation first.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function fail(msg) {
  console.error(`\n[X] ${msg}\n`);
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}
const vault = env.VAULT_CONTRACT_ID;
const owner = env.OWNER_ACCOUNT_ID;
const network = env.NEAR_NETWORK || 'testnet';
const rpc = env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
if (!vault || !owner) fail('VAULT_CONTRACT_ID / OWNER_ACCOUNT_ID missing in .env');

async function view(method, args = {}) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'query',
      params: { request_type: 'call_function', finality: 'final', account_id: vault, method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64') },
    }),
  });
  const body = await res.json();
  if (!body.result?.result) fail(`View ${method} failed: ${JSON.stringify(body.error || body.result)}`);
  return JSON.parse(Buffer.from(body.result.result).toString('utf8'));
}

function ownerCall(method, args, gas = '30.0 Tgas') {
  const runJs = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'near-cli-rs', 'run-near.js');
  const [cmd, prefix] = fs.existsSync(runJs) ? [process.execPath, [runJs]] : ['near', []];
  const res = spawnSync(cmd, [...prefix,
    'contract', 'call-function', 'as-transaction', vault, method, 'json-args', JSON.stringify(args),
    'prepaid-gas', gas, 'attached-deposit', '0 NEAR', 'sign-as', owner,
    'network-config', network, 'sign-with-keychain', 'send'], { stdio: 'inherit' });
  if (res.status !== 0) fail(`${method} failed. See the near-cli output above.`);
}

const near = (y) => `${Number(BigInt(y) / 10n ** 18n) / 1e6} NEAR`;

async function latestHeld() {
  const reqs = await view('get_recent_requests', { limit: 50 });
  const held = reqs.find((r) => r.status === 'PendingApproval');
  if (!held) fail('No request is waiting for approval.');
  const expiresMs = Number(BigInt(held.expiry_ns) / 1_000_000n);
  console.log('\nHeld request');
  console.log(`  id:         ${held.request_id}`);
  console.log(`  amount:     ${near(held.amount)}`);
  console.log(`  recipient:  ${held.recipient}`);
  console.log(`  risk:       ${held.risk_score}`);
  console.log(`  policy:     v${held.policy_version}`);
  console.log(`  expires:    ${new Date(expiresMs).toISOString()}${expiresMs < Date.now() ? '  (EXPIRED)' : ''}`);
  return held;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  if (answer !== 'y') fail('Cancelled.');
}

const action = process.argv[2];
if (action === 'approve') {
  const r = await latestHeld();
  await confirm(`You are authorizing ONLY this request: ${near(r.amount)} to ${r.recipient}. Approve?`);
  ownerCall('approve_request', { request_id: r.request_id }, '50.0 Tgas');
  const after = await view('get_request', { request_id: r.request_id });
  console.log(`\nOn-chain status now: ${after.status}`);
} else if (action === 'reject') {
  const r = await latestHeld();
  await confirm('Reject this request and release its reservation?');
  ownerCall('reject_request', { request_id: r.request_id, reason: 'Rejected by owner' });
  console.log(`\nOn-chain status now: ${(await view('get_request', { request_id: r.request_id })).status}`);
} else if (action === 'freeze' || action === 'unfreeze') {
  ownerCall(action, {});
  console.log(`\nVault frozen: ${(await view('get_vault_status')).is_frozen}`);
} else {
  fail('Usage: node scripts/owner.mjs approve|reject|freeze|unfreeze');
}
console.log('\nDone. Close this window and tell Claude.');
