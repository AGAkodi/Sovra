import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import { api, Vault, Agent, PaymentRequest, AuditEvent, RiskEvaluation, Health } from './api/client';
import { Topbar } from './components/Topbar';
import { Sidebar, ScreenId } from './components/Sidebar';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { OverviewScreen } from './screens/OverviewScreen';
import { AgentMonitorScreen } from './screens/AgentMonitorScreen';
import { PaymentRequestsScreen } from './screens/PaymentRequestsScreen';
import { ApprovalCenterScreen } from './screens/ApprovalCenterScreen';
import { PolicyStudioScreen, PolicyDraft } from './screens/PolicyStudioScreen';
import { AuditTrailScreen } from './screens/AuditTrailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WalletProvider, useWallet } from './wallet/WalletContext';
import { TxToast } from './wallet/TxToast';
import { FundVaultControl } from './wallet/FundVaultControl';
import { AgentInfo, DEFAULT_AGENT_INFO } from './scenarios';
import { ScenarioResultCard, ScenarioRun } from './components/ScenarioResultCard';

const yoctoFromNear = (near: number) => (BigInt(Math.round(near * 1e6)) * 10n ** 18n).toString();

interface AppData {
  health: Health | null;
  vault: Vault | null;
  agent: Agent | null;
  requests: PaymentRequest[];
  events: AuditEvent[];
  isSyncing: boolean;
  /** True once the first fetch has finished (successfully or not). */
  loaded: boolean;
  lastUpdated: Date;
  fetchData: () => Promise<void>;
}

/** Loads backend data and provides the wallet; owner identity comes from the vault contract. */
export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [healthData, vaultData, agentsData, requestsData, eventsData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getVault().catch(() => null),
        api.getAgents().catch(() => []),
        api.getPaymentRequests().catch(() => []),
        api.getEvents().catch(() => []),
      ]);
      setHealth(healthData);
      // Keep the last good vault, but carry over the backend's stale flag.
      if (vaultData) setVault(vaultData);
      else if (!healthData) setVault((v) => (v ? { ...v, stale: true } : v));
      if (agentsData && agentsData.length > 0) setAgent(agentsData[0]);
      if (requestsData) setRequests(requestsData);
      if (eventsData) setEvents(eventsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Data sync error:', err);
    } finally {
      setIsSyncing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const testnetMode = health?.chain_mode === 'testnet';
  return (
    <WalletProvider vaultContractId={testnetMode ? health?.vault_contract_id : null} ownerId={testnetMode ? vault?.owner_id : null}>
      <Shell data={{ health, vault, agent, requests, events, isSyncing, loaded, lastUpdated, fetchData }} />
    </WalletProvider>
  );
}

function Shell({ data }: { data: AppData }) {
  const { health, vault, agent, requests, events, isSyncing, loaded, lastUpdated, fetchData } = data;
  const [menuOpen, setMenuOpen] = useState(false);
  const connection: 'loading' | 'live' | 'stale' | 'offline' = !loaded
    ? 'loading'
    : !health
      ? 'offline'
      : vault?.stale
        ? 'stale'
        : 'live';
  const wallet = useWallet();
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<RiskEvaluation | undefined>(undefined);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);

  const testnetMode = health?.chain_mode === 'testnet';
  const agentInfo: AgentInfo = health
    ? { mode: health.agent_mode ?? 'scripted', model: health.agent_model ?? null, demoScale: health.demo_scale ?? 1 }
    : DEFAULT_AGENT_INFO;
  /** Why an owner action can't be signed right now (undefined = allowed). */
  const ownerBlockedReason = !testnetMode
    ? undefined
    : !wallet.accountId
      ? 'Connect the owner wallet to sign this action.'
      : !wallet.isOwner
        ? `Connected account is not the vault owner (${vault?.owner_id ?? 'unknown'}).`
        : undefined;

  const requireOwner = () => {
    if (ownerBlockedReason) throw new Error(ownerBlockedReason);
  };

  const handleSelectRequest = async (req: PaymentRequest) => {
    setSelectedRequest(req);
    try {
      const details = await api.getPaymentRequestDetails(req.id);
      setSelectedEvaluation(details.evaluation);
    } catch {
      setSelectedEvaluation(undefined);
    }
  };

  const handleToggleFreeze = async () => {
    if (!vault) return;
    try {
      if (testnetMode) {
        requireOwner();
        const method = vault.is_frozen ? 'unfreeze' : 'freeze';
        await wallet.vaultCall(method, {}, { label: vault.is_frozen ? 'Release vault freeze' : 'Emergency freeze vault' });
      } else if (vault.is_frozen) {
        await api.unfreezeAgent(agent?.id || 'agent-01');
      } else {
        await api.freezeAgent(agent?.id || 'agent-01', 'Operator manual freeze action');
      }
    } catch (err) {
      if (!testnetMode || ownerBlockedReason) alert((err as Error).message);
    } finally {
      await fetchData();
    }
  };

  const handleRunScenario = async (scenario: 'routine' | 'spike' | 'injection') => {
    setIsScenarioRunning(true);
    setScenarioRun({ phase: 'running', scenario });
    try {
      const outcome = await api.runScenario(scenario);
      setScenarioRun({ phase: 'done', scenario, outcome });
      await fetchData();
    } catch (err) {
      setScenarioRun({ phase: 'error', scenario, error: (err as Error).message });
    } finally {
      setIsScenarioRunning(false);
    }
  };

  const findRequest = (id: string) => {
    const req = requests.find((r) => r.id === id || r.request_id === id);
    if (!req) throw new Error('Request not found; refresh and try again.');
    return req;
  };

  const handleApprove = async (id: string) => {
    if (!testnetMode) {
      await api.approveRequest(id);
      await fetchData();
      return;
    }
    requireOwner();
    const req = findRequest(id);
    try {
      await wallet.vaultCall('approve_request', { request_id: req.request_id }, {
        label: `Approve ${req.amount_near} NEAR to ${req.recipient}`,
        gasTgas: 50,
      });
    } catch {
      // Wallet errors are shown in the transaction toast.
    } finally {
      await api.syncRequest(req.id).catch(() => undefined);
      await fetchData();
    }
  };

  const handleReject = async (id: string, reason: string) => {
    if (!testnetMode) {
      await api.rejectRequest(id, reason);
      await fetchData();
      return;
    }
    requireOwner();
    const req = findRequest(id);
    try {
      await wallet.vaultCall('reject_request', { request_id: req.request_id, reason }, {
        label: `Reject ${req.amount_near} NEAR to ${req.recipient}`,
      });
    } catch {
      // Wallet errors are shown in the transaction toast.
    } finally {
      await api.syncRequest(req.id).catch(() => undefined);
      await fetchData();
    }
  };

  const handleFund = async (amountNear: number) => {
    requireOwner();
    try {
      await wallet.vaultCall('deposit', {}, { label: `Deposit ${amountNear} NEAR into the vault`, depositYocto: yoctoFromNear(amountNear) });
    } finally {
      await fetchData();
    }
  };

  const handleUpdatePolicy = async (policy: PolicyDraft) => {
    if (!testnetMode) {
      await api.updatePolicy(policy);
      await fetchData();
      return;
    }
    requireOwner();
    // set_policy replaces the signer key too; passing none would switch off attestation checks.
    const signerPk = vault?.policy_signer_pk;
    if (!signerPk) throw new Error('Current policy signer key unknown; refresh and try again.');
    try {
      await wallet.vaultCall(
        'set_policy',
        {
          per_tx_cap: yoctoFromNear(policy.perTxCapNear),
          daily_budget: yoctoFromNear(policy.dailyBudgetNear),
          require_whitelist: policy.requireWhitelist,
          max_risk_for_autonomous: policy.maxRiskForAutonomous,
          policy_signer_pk: signerPk,
        },
        { label: `Update policy to v${(vault?.policy_version ?? 1) + 1}: cap ${policy.perTxCapNear} NEAR, budget ${policy.dailyBudgetNear} NEAR` }
      );
    } finally {
      await fetchData();
    }
  };

  const pendingApprovalsCount = requests.filter((r) => r.status === 'pending_approval').length;
  const fundControl = testnetMode ? <FundVaultControl disabledReason={ownerBlockedReason} onFund={handleFund} /> : undefined;

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col font-sans">
      <Topbar
        onRefresh={fetchData}
        lastUpdated={lastUpdated}
        isSyncing={isSyncing}
        vaultContractId={vault?.contract_id}
        ownerId={vault?.owner_id}
        testnetMode={testnetMode}
        connection={connection}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((o) => !o)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          pendingApprovalsCount={pendingApprovalsCount}
          isFrozen={Boolean(vault?.is_frozen)}
          onToggleFreeze={handleToggleFreeze}
          freezeBlockedReason={ownerBlockedReason}
          mobileOpen={menuOpen}
          onCloseMobile={() => setMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {connection === 'offline' && (
            <div role="alert" className="mb-5 p-3 rounded-card border border-blocked-red/40 bg-blocked-redDim/30 text-xs text-text-primary flex items-start gap-2">
              <WifiOff className="w-4 h-4 text-blocked-red shrink-0 mt-0.5" />
              <span>
                The backend API is unreachable, so nothing below is current and scenarios can't run. Retrying every 8 seconds.
                {vault && ' Showing the last data received.'}
              </span>
            </div>
          )}
          {connection === 'stale' && (
            <div role="status" className="mb-5 p-3 rounded-card border border-caution-amber/40 bg-caution-amberDim/30 text-xs text-text-primary flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-caution-amber shrink-0 mt-0.5" />
              <span>Couldn't re-read the vault contract from NEAR RPC. Balances and policy are the last known values; the vault still enforces its own rules.</span>
            </div>
          )}
          {!loaded ? (
            <div className="py-24 flex flex-col items-center gap-3 text-text-muted text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-telemetry-cyan" />
              <span>Reading vault state from NEAR testnet…</span>
            </div>
          ) : (
          <>
          {currentScreen === 'overview' && (
            <OverviewScreen
              vault={vault}
              agent={agent}
              requests={requests}
              onSelectRequest={handleSelectRequest}
              onRunScenario={handleRunScenario}
              isScenarioRunning={isScenarioRunning}
              onNavigateToTab={(tab) => setCurrentScreen(tab as ScreenId)}
              fundControl={fundControl}
              agentInfo={agentInfo}
            />
          )}

          {currentScreen === 'agent' && (
            <AgentMonitorScreen
              agent={agent}
              vault={vault}
              requests={requests}
              onRunScenario={handleRunScenario}
              isScenarioRunning={isScenarioRunning}
              onSelectRequest={handleSelectRequest}
              agentInfo={agentInfo}
            />
          )}

          {currentScreen === 'payments' && <PaymentRequestsScreen requests={requests} onSelectRequest={handleSelectRequest} />}

          {currentScreen === 'approvals' && (
            <ApprovalCenterScreen
              requests={requests}
              vault={vault}
              onApprove={handleApprove}
              onReject={handleReject}
              ownerBlockedReason={ownerBlockedReason}
            />
          )}

          {currentScreen === 'policies' && (
            <PolicyStudioScreen
              vault={vault}
              onUpdatePolicy={handleUpdatePolicy}
              testnetMode={testnetMode}
              ownerBlockedReason={ownerBlockedReason}
              demoScale={agentInfo.demoScale}
            />
          )}

          {currentScreen === 'audit' && <AuditTrailScreen events={events} />}

          {currentScreen === 'settings' && <SettingsScreen vault={vault} />}
          </>
          )}
        </main>
      </div>

      <EvidenceDrawer
        request={selectedRequest}
        evaluation={selectedEvaluation}
        onClose={() => {
          setSelectedRequest(null);
          setSelectedEvaluation(undefined);
        }}
      />
      <ScenarioResultCard run={scenarioRun} onClose={() => setScenarioRun(null)} />
      <TxToast />
    </div>
  );
}

export default App;
