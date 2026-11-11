/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEAR_NETWORK?: 'testnet' | 'mainnet';
  readonly VITE_NEAR_RPC_URL?: string;
  /** Backend base URL when hosted (e.g. https://sovra-api.vercel.app). Defaults to /api (Vite proxy). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
