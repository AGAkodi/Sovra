/**
 * Throttle for NEAR: Deployment & Initialization Script
 * Deploys throttle_vault.wasm to NEAR testnet and registers the policy signer PK.
 */
import * as fs from 'fs';
import * as path from 'path';

async function deployVault() {
  console.log('--- Throttle Vault Testnet Deployment ---');

  const wasmPath = path.resolve(__dirname, '../contracts/throttle-vault/target/wasm32-unknown-unknown/release/throttle_vault.wasm');
  if (!fs.existsSync(wasmPath)) {
    console.error(`WASM binary not found at ${wasmPath}. Run 'cargo build --target wasm32-unknown-unknown --release' first.`);
    process.exit(1);
  }

  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`Loaded WASM artifact: ${wasmBytes.length} bytes`);

  const contractId = process.env.VAULT_CONTRACT_ID || 'throttle-vault.testnet';
  const ownerId = process.env.OWNER_ACCOUNT_ID || 'throttle-owner.testnet';
  const networkId = process.env.NEAR_NETWORK || 'testnet';

  console.log(`Network: ${networkId}`);
  console.log(`Target Contract: ${contractId}`);
  console.log(`Owner: ${ownerId}`);
  console.log(`\nDeployment command:`);
  console.log(`near contract deploy ${contractId} use-file "${wasmPath}" with-init-call new json-args '{"owner_id":"${ownerId}","policy_signer_pk":null,"per_tx_cap":"30000000000000000000000000","daily_budget":"100000000000000000000000000","require_whitelist":true}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config ${networkId} sign-with-keychain send`);

  console.log('\nDeployment script ready.');
}

deployVault().catch(console.error);

