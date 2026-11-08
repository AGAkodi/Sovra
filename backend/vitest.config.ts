import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests must never broadcast to testnet, even if a local .env has credentials.
    env: { NEAR_MODE: 'simulation' },
  },
});
