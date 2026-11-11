# Testnet Setup (Day 2)

This takes the vault from "built" to "live on NEAR testnet" with real transactions. You run the `near` commands yourself, because they create accounts and sign with keys in your own keychain. Nothing here uses real funds.

**Use Git Bash** for every command below. Windows PowerShell 5.1 strips the double quotes inside JSON arguments (`'{"a":"b"}'`) when calling programs like `near`, which breaks the contract calls.

---

## 1. Install near-cli-rs

Pick one (from the [NEAR CLI docs](https://docs.near.org/tools/near-cli)):

```bash
npm install -g near-cli-rs@latest
```

Or the PowerShell installer (this one is fine in PowerShell, it's just a download):

```bash
irm https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.ps1 | iex
```

Check: `near --version`

## 2. Choose account names and create `.env`

Account names must be globally unique on testnet. Pick a short suffix (e.g. your initials and a number) and use it for all five:

| Role | Example | Notes |
|---|---|---|
| Owner | `sovra-owner-ag1.testnet` | Your wallet identity for approvals and freeze |
| Vault | `sovra-vault-ag1.testnet` | The contract lives here |
| Agent | `sovra-agent-ag1.testnet` | Backend gets **only** a restricted key for this account |
| Recipient | `sovra-worker-ag1.testnet` | Whitelisted payee |
| Attacker | `sovra-attacker-ag1.testnet` | Never whitelisted; target of the injection scenario |

```bash
cp .env.example .env
```

Fill in the five account IDs and set `VAULT_CONTRACT_ID` to the vault name. Add:

```
DEMO_SCALE=0.1
NEAR_MODE=testnet
```

`DEMO_SCALE=0.1` makes the demo 0.3 / 2.5 / 8 NEAR with a 3 NEAR per-transaction cap and a 10 NEAR daily budget, so faucet balances are enough. Risk scores and authority levels are identical at any scale.

## 3. Generate the policy signer and agent keys

```bash
npm --prefix backend run keygen
```

Paste all four lines (`POLICY_SIGNER_*`, `AGENT_*`) into `.env`. `.env` is git-ignored; never commit it or paste the private keys anywhere else.

## 4. Get the deployable wasm

Download the **`sovra_vault-wasm`** artifact from the latest green CI run on GitHub (Actions → the run → Artifacts), unzip it, and set:

```
WASM_PATH=C:/path/to/sovra_vault.wasm
```

(This is the `cargo near build` output, the build path near-sdk recommends. A local `npm run build:contract` also works as a fallback.)

## 5. Print your exact commands

```bash
npx --prefix backend ts-node scripts/deploy.ts
```

This reads `.env` and prints every command with your names, keys and scaled caps filled in. Run them **in order**:

1. **Create the five accounts** with the faucet. After each, check the balance: `near account view-account-summary <id> network-config testnet now`. The vault needs roughly 5 NEAR to cover storage for the contract code (about 0.47 MB at 0.01 NEAR per KB).
2. **Deploy and initialise** the vault.
3. **Approve the agent and whitelist the recipient.**
4. **Owner deposit** (demo step 1). The tx hash is your first piece of evidence.
5. **Add the restricted agent key**: function-call only, `request_payment` only, on the vault only, 1 NEAR gas allowance.
6. **Verify**: `get_vault_status` should show your owner, `policy_signer_pk`, and the caps; `list-keys` on the agent should show the function-call key restricted to the vault.

If a near-cli-rs flag has changed in your version, run the command without its tail to enter interactive mode, or check `near <command> --help`.

## 6. First real payments

```bash
npm --prefix backend run dev
```

The startup log must say `Chain mode: TESTNET`. Then, in a second Git Bash window:

```bash
curl -s -X POST localhost:3001/scenarios/run -H 'Content-Type: application/json' -d '{"scenario":"routine"}'
curl -s -X POST localhost:3001/scenarios/run -H 'Content-Type: application/json' -d '{"scenario":"spike"}'
curl -s -X POST localhost:3001/scenarios/run -H 'Content-Type: application/json' -d '{"scenario":"injection"}'
```

Expected:

| Scenario | `requestStatus` | `decidedBy` | On-chain |
|---|---|---|---|
| routine (0.3 NEAR) | `succeeded` | `vault` | Transfer to recipient, request `Succeeded` |
| spike (2.5 NEAR) | `pending_approval` | `vault` | Request `PendingApproval`, 2.5 NEAR reserved |
| injection (8 NEAR → attacker) | `rejected` | `vault` | Request `Rejected` ("exceeds per_tx_cap"), nothing moved |

Open each `txHash` at `https://testnet.nearblocks.io/txns/<hash>` and record them in `IMPLEMENTATION_LOG.md`.

**Approve the held spike** as the owner (until the wallet UI lands on Day 3):

```bash
near contract call-function as-transaction <VAULT> approve_request json-args '{"request_id":"<id from spike>"}' prepaid-gas '50.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as <OWNER> network-config testnet sign-with-keychain send
curl -s -X POST localhost:3001/payment-requests/<id>/sync
```

**Freeze test** (demo step 5):

```bash
near contract call-function as-transaction <VAULT> freeze json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as <OWNER> network-config testnet sign-with-keychain send
curl -s -X POST localhost:3001/scenarios/run -H 'Content-Type: application/json' -d '{"scenario":"routine"}'
```

The routine request should come back `rejected` with "Vault is frozen", with a tx hash proving the vault refused it. Unfreeze afterwards with `unfreeze`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend exits: `POLICY_SIGNER_PRIVATE_KEY is required` | Key missing from `.env` in testnet mode |
| `Invalid attestation signature` | `.env` signer key doesn't match `policy_signer_pk` on the vault, or `NEAR_NETWORK` ≠ the vault's `chain_id` |
| `Policy version mismatch` | Shouldn't happen (backend reads it from chain); restart backend after `set_policy` |
| `Unauthorized agent` | Step 3 `set_agent` not run, or wrong `AGENT_ACCOUNT_ID` |
| `Insufficient vault balance` | Deposit more, or lower `DEMO_SCALE` |
| Agent key errors / `NotEnoughAllowance` | Re-add the function-call key with a larger allowance |
| Deploy fails with a wasm preparation error | Use the CI `cargo near` artifact rather than a local plain `cargo build` |
| 503 `fail_closed` | RPC unreachable; try another `NEAR_RPC_URL` |

## Optional: lock the vault before the demo

The vault account still holds the full-access key you created it with, which could redeploy the contract. For the final demo you can delete that key so the code is immutable. Only do this once you're sure no more contract changes are needed.
