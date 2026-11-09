import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { Agent, Health, Vault } from '../api/client';
import { Card, SectionHead } from '../ui/Surface';
import { EXPLORER_ACCOUNT, shortHash } from '../design/format';

interface SettingsScreenProps {
  vault: Vault | null;
  health: Health | null;
  agent: Agent | null;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');
const RPC = import.meta.env.VITE_NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
const EXPLORER = 'https://testnet.nearblocks.io';

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard unavailable; the value stays selectable.
        }
      }}
      className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised transition-colors duration-hover ease-vault"
      aria-label="Copy"
      title="Copy"
    >
      {done ? <Check className="w-4 h-4 text-positive" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
    </button>
  );
};

/** One setting: label on the left, value (mono when it's an identifier) with copy or link on the right. */
const Row: React.FC<{ label: string; value?: string; display?: React.ReactNode; mono?: boolean; href?: string; note?: string }> = ({
  label,
  value,
  display,
  mono = true,
  href,
  note,
}) => (
  <div className="py-3 grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-x-6 gap-y-1 border-b border-line last:border-b-0">
    <dt className="text-caption text-fg-2">{label}</dt>
    <dd className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`${mono ? 'font-mono text-caption' : 'text-body'} text-fg truncate`} title={value}>
          {display ?? value ?? '—'}
        </span>
        {value && <CopyButton value={value} />}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-control text-fg-3 hover:text-fg hover:bg-raised"
            aria-label={`Open ${label} on NEAR`}
            title="Open on NEAR"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
          </a>
        )}
      </div>
      {note && <p className="mt-1 text-meta text-fg-3">{note}</p>}
    </dd>
  </div>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ vault, health, agent }) => {
  const testnet = health?.chain_mode === 'testnet';
  const apiUrl = API_BASE.startsWith('http') ? API_BASE : `${window.location.origin}${API_BASE}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise">
        <h1 className="font-display text-page text-fg">Settings</h1>
        <p className="mt-1 text-caption text-fg-3">How this Sovra is set up. Limits are changed on the Limits screen; everything else here is read only</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <Card className="animate-rise [animation-delay:50ms]">
          <SectionHead title="Wallet and vault" />
          <dl>
            <Row label="Vault contract" value={vault?.contract_id} href={vault?.contract_id ? `${EXPLORER_ACCOUNT}${vault.contract_id}` : undefined} />
            <Row label="Owner" value={vault?.owner_id} href={vault?.owner_id ? `${EXPLORER_ACCOUNT}${vault.owner_id}` : undefined} note="The only account that can approve, decline, freeze, add funds or change limits" />
            <Row label="Network" display="NEAR testnet" mono={false} note={testnet ? 'Live: every payment is a real testnet transaction' : 'Simulation: nothing is sent to NEAR'} />
            <Row label="Limits version" display={vault ? `Version ${vault.policy_version}` : '—'} mono={false} />
          </dl>
        </Card>

        <Card className="animate-rise [animation-delay:100ms]">
          <SectionHead title="Keys" meta="Who can do what" />
          <dl>
            <Row label="Your wallet" display="Full control of the vault’s settings" mono={false} note="Signs every approval, decline, freeze and limit change, with 1 yoctoNEAR attached so a leaked session key can’t" />
            <Row label="Agent key" display="Can only call request_payment" mono={false} note="It can ask the vault to pay; it can’t move money, approve its own requests or change limits" />
            <Row
              label="Risk check key"
              value={vault?.policy_signer_pk || undefined}
              display={vault?.policy_signer_pk ? shortHash(vault.policy_signer_pk, 16, 6) : undefined}
              note="Signs each risk decision; the vault checks the signature before acting"
            />
          </dl>
          <p className="mt-4 text-meta text-fg-3">
            While testing, the vault account also keeps a deploy key so the contract can be upgraded. A production vault would remove it or put upgrades behind a multisig
          </p>
        </Card>

        <Card className="animate-rise [animation-delay:150ms]">
          <SectionHead title="Agent" />
          <dl>
            <Row label="Account" value={agent?.account_id} href={agent?.account_id ? `${EXPLORER_ACCOUNT}${agent.account_id}` : undefined} />
            <Row
              label="Reads invoices with"
              display={health?.agent_mode === 'llm' ? health.agent_model ?? 'An LLM' : 'Scripted proposals (no LLM set up)'}
              mono={health?.agent_mode === 'llm'}
              note={health?.agent_mode === 'llm' ? 'The model only proposes a payment. The risk check and the vault decide' : undefined}
            />
          </dl>
        </Card>

        <Card className="animate-rise [animation-delay:200ms]">
          <SectionHead title="Connections" />
          <dl>
            <Row label="Sovra server" value={apiUrl} />
            <Row label="NEAR RPC" value={RPC} />
            <Row label="Explorer" value={EXPLORER} href={EXPLORER} />
            <Row
              label="History storage"
              display={health?.store_mode === 'supabase' ? 'Supabase (Postgres), append-only activity log' : 'In memory, cleared on restart'}
              mono={false}
            />
            {health?.demo_scale !== undefined && health.demo_scale !== 1 && (
              <Row label="Demo amounts" display={`Scaled to ${health.demo_scale * 100}% for testnet balances`} mono={false} />
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
};
