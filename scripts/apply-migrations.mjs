/**
 * Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL (.env), in
 * filename order, recording each in a schema_migrations table so re-runs are safe.
 * Then checks the API path the backend uses (SUPABASE_URL + service-role key).
 *
 * Run: double-click scripts/apply-migrations.cmd   (or: node scripts/apply-migrations.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'backend', 'package.json'));
const { Client } = require('pg');

function fail(msg) {
  console.error(`\n[X] ${msg}\n`);
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}
const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) fail('SUPABASE_DB_URL is empty in .env (Supabase > Connect > "Session pooler" connection string, with your DB password).');

const dir = path.join(ROOT, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
} catch (e) {
  fail(`Could not connect to the database: ${e.message}\nCheck the password in SUPABASE_DB_URL and use the Session pooler string.`);
}

await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
await client.query('alter table schema_migrations enable row level security');
const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));

for (const f of files) {
  if (done.has(f)) {
    console.log(`[ok] ${f} already applied`);
    continue;
  }
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations(name) values ($1)', [f]);
    await client.query('commit');
    console.log(`[ok] applied ${f}`);
  } catch (e) {
    await client.query('rollback');
    fail(`${f} failed: ${e.message}`);
  }
}

const tables = (await client.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1"
)).rows.map((r) => r.table_name);
console.log(`\nTables: ${tables.join(', ')}`);

try {
  const probe = await client.query("insert into audit_events(event_type, actor, timestamp) values ('MigrationCheck','setup', $1) returning id", [Date.now()]);
  try {
    await client.query('delete from audit_events where id = $1', [probe.rows[0].id]);
    console.log('[!] Warning: audit_events delete was NOT blocked');
  } catch {
    console.log('[ok] audit_events is append-only (delete blocked)');
  }
} finally {
  await client.end();
}

// Check the backend's actual access path (PostgREST with the service-role key).
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/agents?select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  console.log(res.ok ? '[ok] Backend API access works (SUPABASE_URL + service-role key)' : `[X] API check failed: HTTP ${res.status} ${await res.text()}`);
} else {
  console.log('[!] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set yet; the backend will keep using memory.');
}
console.log('\nDone. Close this window and tell Claude.');
