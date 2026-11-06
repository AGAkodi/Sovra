-- Throttle for NEAR: Initial Schema Migration
-- Tables: users, agents, vaults, policies, policy_versions, payment_requests,
--         risk_evaluations, trust_events, approvals, chain_transactions, audit_events, demo_scenarios

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    near_account_id TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    contract_id TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    network TEXT NOT NULL DEFAULT 'testnet',
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    policy_version INTEGER NOT NULL DEFAULT 1,
    per_tx_cap_near NUMERIC NOT NULL DEFAULT 10.0,
    daily_budget_near NUMERIC NOT NULL DEFAULT 50.0,
    require_whitelist BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    public_key TEXT,
    name TEXT NOT NULL,
    trust_score NUMERIC NOT NULL DEFAULT 50.0,
    authority_level INTEGER NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    per_tx_cap_near NUMERIC NOT NULL,
    daily_budget_near NUMERIC NOT NULL,
    require_whitelist BOOLEAN NOT NULL,
    max_risk_for_autonomous INTEGER NOT NULL DEFAULT 69,
    policy_signer_pk TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    amount_near NUMERIC NOT NULL,
    amount_yocto TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    authority_level INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'pending_approval', 'approved', 'executing', 'succeeded', 'failed', 'rejected'
    reason TEXT,
    tx_hash TEXT,
    expiry_ns BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_vault_request UNIQUE (vault_id, request_id)
);

CREATE TABLE IF NOT EXISTS risk_evaluations (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    composite_risk INTEGER NOT NULL,
    amount_risk INTEGER NOT NULL,
    velocity_risk INTEGER NOT NULL,
    recipient_risk INTEGER NOT NULL,
    evidence_risk INTEGER NOT NULL,
    failure_risk INTEGER NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    attestation_signature TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trust_events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    previous_score NUMERIC NOT NULL,
    new_score NUMERIC NOT NULL,
    delta NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    payment_request_id TEXT NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
    owner_account_id TEXT NOT NULL,
    decision TEXT NOT NULL, -- 'approved', 'rejected'
    decision_reason TEXT,
    signature TEXT,
    tx_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chain_transactions (
    id TEXT PRIMARY KEY,
    tx_hash TEXT UNIQUE NOT NULL,
    request_id TEXT,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    method_name TEXT NOT NULL,
    amount_near NUMERIC,
    status TEXT NOT NULL, -- 'succeeded', 'failed', 'pending'
    receipt_data JSONB,
    block_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    tx_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS demo_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    scenario_type TEXT NOT NULL, -- 'routine', 'anomaly_hold', 'prompt_injection'
    payload JSONB NOT NULL,
    expected_outcome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and quick lookup
CREATE INDEX IF NOT EXISTS idx_requests_vault_agent ON payment_requests(vault_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chain_tx_hash ON chain_transactions(tx_hash);

