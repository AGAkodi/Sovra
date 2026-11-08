import React from 'react';
import { Vault } from '../api/client';
import { Settings, Shield, Key, Network, Database } from 'lucide-react';

interface SettingsScreenProps {
  vault: Vault | null;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ vault }) => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">System Settings & Identities</h1>
        <p className="text-xs text-text-muted mt-0.5">
          NEAR testnet connection parameters, cryptographic keys, and environment configuration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network & RPC */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Network className="w-4 h-4 text-telemetry-cyan" />
            NEAR Network Configuration
          </h2>
          <div className="space-y-2 pt-1">
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Network</span>
              <span className="font-mono text-text-primary">NEAR Testnet</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Primary RPC</span>
              <span className="font-mono text-text-secondary">https://test.rpc.fastnear.com</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Explorer URL</span>
              <span className="font-mono text-telemetry-cyan">https://testnet.nearblocks.io</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Archival RPC</span>
              <span className="font-mono text-text-secondary">https://archival-rpc.testnet.fastnear.com</span>
            </div>
          </div>
        </div>

        {/* Contract & Vault */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Shield className="w-4 h-4 text-telemetry-cyan" />
            Throttle Vault Contract
          </h2>
          <div className="space-y-2 pt-1">
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Contract ID</span>
              <span className="font-mono text-telemetry-cyan">{vault?.contract_id || 'throttle-vault.testnet'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Owner Account</span>
              <span className="font-mono text-text-primary">{vault?.owner_id || 'throttle-owner.testnet'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle/50">
              <span className="text-text-muted">Policy Signer PK</span>
              <span className="font-mono text-text-secondary truncate max-w-[180px]">
                {vault?.policy_signer_pk || 'ed25519:...'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">SDK Standard</span>
              <span className="font-mono text-text-secondary">near-sdk-rs 5.7 (Rust)</span>
            </div>
          </div>
        </div>

        {/* Security & Access Keys */}
        <div className="p-5 rounded-panel bg-surface-raised border border-border-subtle space-y-3 text-xs md:col-span-2">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Key className="w-4 h-4 text-confirmed-green" />
            Principle of Least Privilege Key Matrix
          </h2>
          <p className="text-text-muted">
            Throttle enforces cryptographic separation between agent proposing capabilities and treasury ownership.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="font-semibold text-text-primary block">Owner Keypair</span>
              <span className="text-[11px] text-text-muted block mt-1">FullAccess permission.</span>
              <span className="text-[10px] text-confirmed-green font-mono block mt-2">
                Controlled strictly by operator wallet
              </span>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="font-semibold text-text-primary block">Agent Runtime Key</span>
              <span className="text-[11px] text-text-muted block mt-1">
                Restricted FunctionCall key.
              </span>
              <span className="text-[10px] text-telemetry-cyan font-mono block mt-2">
                method_names: ['request_payment'] only
              </span>
            </div>

            <div className="p-3 rounded-card bg-surface-secondary border border-border-subtle">
              <span className="font-semibold text-text-primary block">Policy Signer Key</span>
              <span className="text-[11px] text-text-muted block mt-1">
                Ed25519 off-chain risk attestation.
              </span>
              <span className="text-[10px] text-caution-amber font-mono block mt-2">
                Enforced on-chain via ed25519_verify
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

