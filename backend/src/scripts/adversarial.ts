/**
 * Live adversarial checks against the deployed testnet vault.
 *
 * Each case sends a deliberately invalid request_payment from the agent's own
 * function-call key and expects the contract to refuse it. Every refusal is a real
 * transaction with a hash. Amounts are tiny (0.01-0.02 NEAR) and go to the
 * whitelisted worker, so even an unexpected pass could not move meaningful funds.
 *
 * Run: npm --prefix backend run adversarial        (needs NEAR_MODE=testnet in .env)
 */
import '../config';
import nacl from 'tweetnacl';
import { randomUUID } from 'node:crypto';
import { AttestationSigner, AttestationPayload } from '../risk/attestation';
import { getNearConfig, getVaultStatus, submitPaymentRequest, RequestPaymentArgs, yoctoToNear } from '../near/client';

const cfg = getNearConfig();
const signer = AttestationSigner.fromEnv(true);
const worker = process.env.RECIPIENT_ACCOUNT_ID || 'sovra-worker-monarch.testnet';
const attacker = process.env.ATTACKER_ACCOUNT_ID || 'sovra-attacker-monarch.testnet';
const yocto = (near: number) => (BigInt(Math.round(near * 1e6)) * 10n ** 18n).toString();
const newId = () => `adv-${randomUUID().replace(/-/g, '').slice(0, 16)}`;

interface Case {
  name: string;
  expect: string;
  build: (policyVersion: number) => RequestPaymentArgs;
}

function signed(policyVersion: number, over: Partial<AttestationPayload> = {}): { payload: AttestationPayload; signature_hex: string } {
  const payload: AttestationPayload = {
    chain_id: cfg.networkId,
    vault_contract_id: cfg.vaultContractId,
    request_id: newId(),
    recipient: worker,
    amount_yocto: yocto(0.01),
    risk_score: 7,
    authority_level: 2,
    policy_version: policyVersion,
    expiry_ns: ((BigInt(Date.now()) + 300_000n) * 1_000_000n).toString(),
    ...over,
  };
  return { payload, signature_hex: signer.signAttestation(payload).signature_hex };
}

const toArgs = (p: AttestationPayload, signature_hex: string): RequestPaymentArgs => ({
  request_id: p.request_id,
  recipient: p.recipient,
  amount_yocto: p.amount_yocto,
  expiry_ns: p.expiry_ns,
  policy_version: p.policy_version,
  risk_score: p.risk_score,
  authority_level: p.authority_level,
  signature_hex,
});

const replayId = process.argv[2]; // optional: an existing on-chain request_id to replay

const cases: Case[] = [
  {
    name: 'Tampered amount (signed 0.01, submitted 0.02 NEAR)',
    expect: 'Invalid attestation signature',
    build: (v) => {
      const { payload, signature_hex } = signed(v);
      return toArgs({ ...payload, amount_yocto: yocto(0.02) }, signature_hex);
    },
  },
  {
    name: 'Tampered recipient (signed for worker, submitted for attacker)',
    expect: 'Invalid attestation signature',
    build: (v) => {
      const { payload, signature_hex } = signed(v);
      return toArgs({ ...payload, recipient: attacker }, signature_hex);
    },
  },
  {
    name: 'Agent lowers its own risk (signed level 6 / risk 92, submitted level 1 / risk 5)',
    expect: 'Invalid attestation signature',
    build: (v) => {
      const { payload, signature_hex } = signed(v, { risk_score: 92, authority_level: 6 });
      return toArgs({ ...payload, risk_score: 5, authority_level: 1 }, signature_hex);
    },
  },
  {
    name: 'Forged attestation (signed by a key that is not the policy signer)',
    expect: 'Invalid attestation signature',
    build: (v) => {
      const forger = AttestationSigner.fromSeed(nacl.randomBytes(32));
      const { payload } = signed(v);
      return toArgs(payload, forger.signAttestation(payload).signature_hex);
    },
  },
  {
    name: 'Expired attestation (expiry 1 minute in the past)',
    expect: 'Attestation expired',
    build: (v) => {
      const { payload, signature_hex } = signed(v, { expiry_ns: ((BigInt(Date.now()) - 60_000n) * 1_000_000n).toString() });
      return toArgs(payload, signature_hex);
    },
  },
  {
    name: 'Stale policy version (attested for the previous policy)',
    expect: 'Policy version mismatch',
    build: (v) => {
      const { payload, signature_hex } = signed(v - 1);
      return toArgs(payload, signature_hex);
    },
  },
];

if (replayId) {
  cases.push({
    name: `Replay of an existing request_id (${replayId}) with a fresh valid signature`,
    expect: 'Duplicate request ID',
    build: (v) => {
      const { payload, signature_hex } = signed(v, { request_id: replayId });
      return toArgs(payload, signature_hex);
    },
  });
}

async function main() {
  if (process.env.NEAR_MODE !== 'testnet') throw new Error('Set NEAR_MODE=testnet: this script sends real testnet transactions.');
  const before = await getVaultStatus();
  const policyVersion = before.policy.version;
  console.log(`Vault ${cfg.vaultContractId}, policy v${policyVersion}, available ${yoctoToNear(before.available_balance)} NEAR\n`);

  const results = [];
  for (const c of cases) {
    const sub = await submitPaymentRequest(c.build(policyVersion));
    const pass = sub.outcome === 'refused' && (sub.reason ?? '').includes(c.expect);
    results.push({ case: c.name, expected: c.expect, outcome: sub.outcome, reason: sub.reason, tx: sub.tx_hash, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}\n      ${sub.outcome}: ${sub.reason ?? ''}\n      tx ${sub.tx_hash ?? '(none)'}\n`);
  }

  const after = await getVaultStatus();
  const moved = BigInt(before.vault_balance) - BigInt(after.vault_balance);
  console.log(`Vault balance change: ${yoctoToNear(moved.toString())} NEAR (gas is paid by the agent, not the vault)`);
  console.log(JSON.stringify({ policy_version: policyVersion, vault_balance_change_yocto: moved.toString(), results }, null, 2));
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
