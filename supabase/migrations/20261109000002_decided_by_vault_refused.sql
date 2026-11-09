-- Distinguish a vault refusal (the call panicked; nothing recorded on-chain)
-- from a rejection the contract recorded.
alter table payment_requests drop constraint if exists payment_requests_decided_by_check;
alter table payment_requests add constraint payment_requests_decided_by_check
  check (decided_by in ('risk_engine','vault','vault_refused','owner','rpc_error'));
