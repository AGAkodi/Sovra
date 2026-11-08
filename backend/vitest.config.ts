import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests must never broadcast to testnet, write to Supabase or call Groq, even if .env has credentials.
    env: { NEAR_MODE: 'simulation', STORE_MODE: 'memory', AGENT_MODE: 'scripted' },
  },
});
