/**
 * Generates NEAR-format ed25519 key pairs for local testnet setup.
 *
 *   npm run keygen            -> policy signer + agent function-call key
 *
 * Prints values to paste into .env. Never commit the private keys.
 */
import nacl from 'tweetnacl';
import { toBase58 } from '../risk/attestation';

function generate(label: string, envPrefix: string) {
  const kp = nacl.sign.keyPair();
  console.log(`# ${label}`);
  console.log(`${envPrefix}_PUBLIC_KEY=ed25519:${toBase58(kp.publicKey)}`);
  console.log(`${envPrefix}_PRIVATE_KEY=ed25519:${toBase58(kp.secretKey)}`);
  console.log('');
}

console.log('# Paste into Sovra/.env (testnet only; do not commit)\n');
generate('Off-chain policy signer (public key goes into the vault init / set_policy)', 'POLICY_SIGNER');
generate('Agent function-call key (public key is added to AGENT_ACCOUNT_ID, restricted to request_payment)', 'AGENT');
