-- Sovra: runtime schema (matches backend/src/db/supabase-repo.ts).
-- Replaces the earlier draft schema, which was never applied or used.
--
-- Security model:
--   * RLS is enabled on every table with NO policies, so the public anon key can
--     neither read nor write. Only the backend's service-role key (which bypasses
--     RLS) can access data. Never expose that key to the browser.
--   * audit_events is append-only: UPDATE and DELETE are rejected by trigger.
--   * The vault contract remains the source of truth for money; these tables hold
--     evidence (task, risk features, decisions) and reconciled status.
-- Timestamps are unix epoch milliseconds (bigint) to match the API.

create extension if not exists pgcrypto;

create table if not exists agents (
  id              text primary key,
  vault_id        text not null,
  account_id      text not null,
  name            text not null,
  trust_score     numeric not null check (trust_score between 0 and 100),
  authority_level smallint not null check (authority_level between 1 and 6),
  is_active       boolean not null default true,
  last_heartbeat  bigint not null,
  updated_at      timestamptz not null default now()
);

create table if not exists payment_requests (
  id              uuid primary key,
  request_id      text not null unique,
  vault_id        text not null,
  agent_id        text not null,
  recipient       text not null,
  amount_near     numeric not null check (amount_near > 0),
  amount_yocto    text not null,
  risk_score      smallint not null check (risk_score between 0 and 100),
  authority_level smallint not null check (authority_level between 1 and 6),
  status          text not null check (status in ('pending_approval','approved','executing','succeeded','failed','rejected','expired')),
  reason          text,
  tx_hash         text unique,
  chain_mode      text not null check (chain_mode in ('testnet','simulation')),
  decided_by      text check (decided_by in ('risk_engine','vault','owner','rpc_error')),
  chain_reason    text,
  policy_version  integer,
  created_at      bigint not null,
  expiry_ns       text not null,
  resolved_at     bigint,
  last_synced_at  bigint,
  task_evidence   jsonb not null
);
create index if not exists payment_requests_created_idx on payment_requests (created_at desc);
create index if not exists payment_requests_open_idx on payment_requests (status) where status in ('pending_approval','executing');
create index if not exists payment_requests_agent_idx on payment_requests (agent_id, created_at desc);

-- Feature snapshot of every evaluation, for replayability.
create table if not exists risk_evaluations (
  request_id      text primary key,
  agent_id        text not null,
  composite_risk  smallint not null,
  authority_level smallint not null,
  reasons         text[] not null default '{}',
  evaluation      jsonb not null,
  evaluated_at    bigint not null
);

create table if not exists audit_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  actor       text not null,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  tx_hash     text,
  "timestamp" bigint not null
);
create index if not exists audit_events_ts_idx on audit_events ("timestamp" desc);
create index if not exists audit_events_target_idx on audit_events (target_id);

create or replace function audit_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

drop trigger if exists audit_events_no_update on audit_events;
create trigger audit_events_no_update before update or delete on audit_events
  for each row execute function audit_events_append_only();

alter table agents enable row level security;
alter table payment_requests enable row level security;
alter table risk_evaluations enable row level security;
alter table audit_events enable row level security;
