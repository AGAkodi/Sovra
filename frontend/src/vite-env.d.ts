/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEAR_NETWORK?: 'testnet' | 'mainnet';
  readonly VITE_NEAR_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
