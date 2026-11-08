/**
 * Owner wallet connection (NEAR Wallet Selector v10).
 *
 * Sign-in deliberately requests NO function-call key for the vault: every owner
 * action is a full-access, wallet-confirmed transaction. The contract enforces the
 * same thing by requiring exactly 1 yoctoNEAR on owner methods.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setupWalletSelector, type WalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { actionCreators } from '@near-js/transactions';
import '@near-wallet-selector/modal-ui/styles.css';

const NETWORK = (import.meta.env.VITE_NEAR_NETWORK as 'testnet' | 'mainnet' | undefined) ?? 'testnet';
const ONE_YOCTO = 1n;
const TGAS = 1_000_000_000_000n;

export type TxPhase = 'idle' | 'wallet' | 'submitted' | 'confirmed' | 'failed';

export interface TxState {
  phase: TxPhase;
  label?: string;
  txHash?: string;
  error?: string;
}

interface OwnerCallOptions {
  label: string;
  gasTgas?: number;
  /** yoctoNEAR as a decimal string. Owner methods need exactly '1'. */
  depositYocto?: string;
}

interface WalletContextValue {
  ready: boolean;
  accountId: string | null;
  isOwner: boolean;
  network: string;
  tx: TxState;
  connect: () => void;
  disconnect: () => Promise<void>;
  /** Calls a vault method as the connected account. Resolves with the tx hash once executed. */
  vaultCall: (method: string, args: Record<string, unknown>, opts: OwnerCallOptions) => Promise<string>;
  clearTx: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** Extracts a readable reason from a NEAR Failure status (e.g. a contract panic message). */
function failureMessage(failure: unknown): string {
  const text = JSON.stringify(failure);
  const panic = text.match(/Smart contract panicked: ([^"\\]+)/);
  if (panic) return panic[1];
  const exec = text.match(/"ExecutionError":"([^"]+)"/);
  return exec ? exec[1] : text.slice(0, 200);
}

export const WalletProvider: React.FC<{ vaultContractId?: string | null; ownerId?: string | null; children: React.ReactNode }> = ({
  vaultContractId,
  ownerId,
  children,
}) => {
  const selectorRef = useRef<WalletSelector | null>(null);
  const modalRef = useRef<WalletSelectorModal | null>(null);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const selector = await setupWalletSelector({
        network: NETWORK,
        modules: [setupMyNearWallet(), setupMeteorWallet()],
      });
      if (cancelled) return;
      selectorRef.current = selector;
      modalRef.current = setupModal(selector, {
        description: 'Connect the vault owner account. Every owner action will ask for confirmation in your wallet.',
      });
      const sub = selector.store.observable.subscribe((state) => {
        const active = state.accounts.find((a) => a.active) ?? state.accounts[0];
        setAccountId(active?.accountId ?? null);
      });
      unsubscribe = () => sub.unsubscribe();
      setReady(true);
    })().catch((err) => {
      console.error('Wallet selector failed to initialise', err);
      setTx({ phase: 'failed', error: `Wallet setup failed: ${(err as Error).message}` });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Redirect-based wallets (MyNearWallet) come back with the result in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashes = params.get('transactionHashes');
    const errorCode = params.get('errorCode');
    if (!hashes && !errorCode) return;
    if (hashes) setTx({ phase: 'submitted', label: 'Wallet transaction', txHash: hashes.split(',').pop() });
    else setTx({ phase: 'failed', label: 'Wallet transaction', error: decodeURIComponent(params.get('errorMessage') || errorCode || 'Rejected in wallet') });
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const connect = useCallback(() => modalRef.current?.show(), []);

  const disconnect = useCallback(async () => {
    const selector = selectorRef.current;
    if (!selector?.isSignedIn()) return;
    const wallet = await selector.wallet();
    await wallet.signOut();
  }, []);

  const vaultCall = useCallback<WalletContextValue['vaultCall']>(
    async (method, args, { label, gasTgas = 30, depositYocto = ONE_YOCTO.toString() }) => {
      const selector = selectorRef.current;
      if (!selector || !selector.isSignedIn()) throw new Error('Connect the owner wallet first.');
      if (!vaultContractId) throw new Error('Vault contract ID unknown (backend not in testnet mode?).');

      setTx({ phase: 'wallet', label });
      try {
        const wallet = await selector.wallet();
        const outcome = await wallet.signAndSendTransaction({
          receiverId: vaultContractId,
          actions: [actionCreators.functionCall(method, args, BigInt(gasTgas) * TGAS, BigInt(depositYocto))],
        });
        if (!outcome) {
          // Redirect wallets navigate away; the result arrives via the return URL.
          setTx({ phase: 'submitted', label });
          return '';
        }
        const txHash = outcome.transaction_outcome?.id ?? outcome.transaction?.hash;
        const status = outcome.status as { Failure?: unknown } | string;
        if (status && typeof status === 'object' && status.Failure) {
          const error = failureMessage(status.Failure);
          setTx({ phase: 'failed', label, txHash, error });
          throw new Error(error);
        }
        setTx({ phase: 'confirmed', label, txHash });
        return txHash;
      } catch (err) {
        const message = (err as Error).message || 'Wallet transaction failed';
        setTx((prev) => (prev.phase === 'failed' ? prev : { phase: 'failed', label, error: message }));
        throw err;
      }
    },
    [vaultContractId]
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      ready,
      accountId,
      isOwner: !!accountId && !!ownerId && accountId === ownerId,
      network: NETWORK,
      tx,
      connect,
      disconnect,
      vaultCall,
      clearTx: () => setTx({ phase: 'idle' }),
    }),
    [ready, accountId, ownerId, tx, connect, disconnect, vaultCall]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
