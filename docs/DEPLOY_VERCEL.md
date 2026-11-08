# Deploying to Vercel

**Live (2026-11-08):** dashboard https://throttle-dashboard-ruddy.vercel.app · API https://throttle-api-mauve.vercel.app (`/health`). Vercel team `monarchs-projects-cc314129`.

> Both projects are connected to `AGAkodi/Sovra`, so pushes to `main` deploy production automatically. The CLI path used for the first deploy: `vercel deploy --prod --yes --project <name>` run from the **repo root** (the projects have Root Directory set; a root `.vercelignore` keeps `.env`, `contracts/`, build output and `node_modules` out of the upload).

Two Vercel projects from the same GitHub repo (`AGAkodi/Sovra`):

| Project | Root directory | What it serves |
|---|---|---|
| `throttle-api` | `backend` | Express API as one serverless function (`backend/api/index.ts`) |
| `throttle-dashboard` | `frontend` | Static Vite build |

Persistence must be Supabase: serverless instances keep no memory between requests.

## 1. Supabase (once)

1. Create a project at supabase.com (free tier is fine).
2. Fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` in your local `.env` (see comments in `.env.example`).
3. Double-click `scripts/apply-migrations.cmd`. It creates the tables, confirms the audit log is append-only, and checks that the service-role key works.

RLS is on for every table with no policies, so the public anon key cannot read anything. The service-role key must never go into a `VITE_` variable or the browser.

## 2. Backend project (`throttle-api`)

New Project → import `AGAkodi/Sovra` → **Root Directory: `backend`** → Framework preset: Other.

Environment variables (Production):

| Variable | Value |
|---|---|
| `NEAR_MODE` | `testnet` |
| `NEAR_NETWORK` | `testnet` |
| `NEAR_RPC_URL` | `https://test.rpc.fastnear.com` |
| `VAULT_CONTRACT_ID` | `sovra-vault-monarch.testnet` |
| `OWNER_ACCOUNT_ID` | `sovra-owner-monarch.testnet` |
| `AGENT_ACCOUNT_ID` | `sovra-agent-monarch.testnet` |
| `RECIPIENT_ACCOUNT_ID` | `sovra-worker-monarch.testnet` |
| `ATTACKER_ACCOUNT_ID` | `sovra-attacker-monarch.testnet` |
| `AGENT_PRIVATE_KEY` | from `.env` (function-call key: can only call `request_payment`) |
| `POLICY_SIGNER_PRIVATE_KEY` | from `.env` |
| `DEMO_SCALE` | `0.1` |
| `STORE_MODE` | `supabase` (fail fast if misconfigured) |
| `SUPABASE_URL` | from `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env` |
| `CORS_ORIGINS` | the dashboard URL, e.g. `https://throttle-dashboard.vercel.app` |
| `CRON_SECRET` | any long random string |

Not needed on Vercel: `SUPABASE_DB_URL`, any public keys, `WASM_PATH`.

Check: `https://<api>.vercel.app/health` should show `"chain_mode":"testnet"`, `"store_mode":"supabase"` and `"policy_signer_ephemeral":false`.

## 3. Dashboard project (`throttle-dashboard`)

New Project → same repo → **Root Directory: `frontend`** → Framework: Vite.

| Variable | Value |
|---|---|
| `VITE_API_BASE` | the API URL, e.g. `https://throttle-api.vercel.app` |
| `VITE_NEAR_NETWORK` | `testnet` |
| `VITE_NEAR_RPC_URL` | `https://test.rpc.fastnear.com` |

Then set the API's `CORS_ORIGINS` to this project's URL and redeploy the API.

## Notes and limits

- **Reconciliation:** the API re-checks open requests against the chain whenever the request list is read (at most every 10 s per instance). The cron at 06:00 UTC is a daily backstop; Vercel's Hobby plan allows only daily cron jobs.
- **Function timeout:** `maxDuration` is 30 s; a testnet `request_payment` normally finishes in a few seconds.
- **Public scenario runner:** anyone with the dashboard URL can trigger the three demo scenarios. Abuse is bounded by the vault's on-chain per-tx cap and daily budget and by a per-IP rate limit (`SPEND_RATE_LIMIT_PER_MIN`, default 6). Owner actions always require the owner's wallet.
