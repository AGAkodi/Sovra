-- How the agent proposed each payment: LLM (model, rationale, latency) or the
-- scripted fallback (with the reason the LLM output was not used).
alter table payment_requests add column if not exists agent jsonb;
