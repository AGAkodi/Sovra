import type { StoredAgent } from './store';

export const DEFAULT_VAULT_ID = 'vault-01';
export const DEFAULT_AGENT_ID = 'agent-01';

/** Initial agent record, created on first use if the store has none. */
export function defaultAgent(): StoredAgent {
  return {
    id: DEFAULT_AGENT_ID,
    vault_id: DEFAULT_VAULT_ID,
    account_id: process.env.AGENT_ACCOUNT_ID || 'throttle-agent.testnet',
    name: 'Autonomous Task Paying Agent',
    trust_score: 82.5,
    authority_level: 1,
    is_active: true,
    last_heartbeat: Date.now(),
  };
}
