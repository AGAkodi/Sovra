import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests must never broadcast to testnet or write to Supabase, even if .env has credentials.
    env: { NEAR_MODE: 'simulation', STORE_MODE: 'memory' },
  },
});
