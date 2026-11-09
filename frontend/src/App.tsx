import React, { useState, useEffect, useCallback } from 'react';
import { api, Vault, Agent, PaymentRequest, AuditEvent, RiskEvaluation, Health } from './api/client';
import { Topbar } from './components/Topbar';
import { HomeScreen } from './screens/HomeScreen';
import { Banner, Skeleton } from './ui/Surface';
import { Sidebar, ScreenId } from './components/Sidebar';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { AgentMonitorScreen } from './screens/AgentMonitorScreen';
import { PaymentRequestsScreen } from './screens/PaymentRequestsScreen';
import { ApprovalCenterScreen } from './screens/ApprovalCenterScreen';
import { PolicyStudioScreen, PolicyDraft } from './screens/PolicyStudioScreen';
import { AuditTrailScreen } from './screens/AuditTrailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WalletProvider, useWallet } from './wallet/WalletContext';
import { TxToast } from './wallet/TxToast';
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
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
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
      ? 'Connect your wallet to do this'
      : !wallet.isOwner
        ? `Only the vault owner (${vault?.owner_id ?? 'unknown'}) can do this`
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
        await wallet.vaultCall(method, {}, { label: vault.is_frozen ? 'Unfreeze spending' : 'Freeze spending' });
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
      await wallet.vaultCall('deposit', {}, { label: `Add ${amountNear} NEAR to the vault`, depositYocto: yoctoFromNear(amountNear) });
    } finally {
      await fetchData();
    }
  };

  const handleWithdraw = async (amountNear: number) => {
    requireOwner();
    try {
      await wallet.vaultCall('withdraw', { amount: yoctoFromNear(amountNear) }, { label: `Withdraw ${amountNear} NEAR to your wallet` });
    } finally {
      await fetchData();
    }
  };

  // A held payment whose approval window lapsed keeps its NEAR reserved on-chain until
  // someone calls expire_request. The vault lets anyone call it; it can only free funds.
  const pendingHeld = requests.filter((r) => r.status === 'pending_approval').reduce((s, r) => s + r.amount_near, 0);
  const lapsedHeld = vault ? Math.max(0, vault.reserved_balance_near - pendingHeld) : 0;
  const lapsedRequest =
    lapsedHeld > 0.000001 ? requests.find((r) => r.status === 'expired' && r.amount_near <= lapsedHeld + 0.000001) : undefined;

  const handleReleaseLapsed = async () => {
    if (!lapsedRequest) return;
    requireOwner();
    try {
      await wallet.vaultCall('expire_request', { request_id: lapsedRequest.request_id }, {
        label: `Release ${lapsedRequest.amount_near} NEAR held by a lapsed request`,
        depositYocto: '0',
      });
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

  return (
    <div className="h-dvh flex overflow-hidden bg-canvas text-fg font-sans">
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        waitingCount={pendingApprovalsCount}
        isFrozen={Boolean(vault?.is_frozen)}
        onToggleFreeze={handleToggleFreeze}
        freezeBlockedReason={ownerBlockedReason}
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
          isSyncing={isSyncing}
          ownerId={vault?.owner_id}
          testnetMode={testnetMode}
          connection={connection}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
        />

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6">
            {connection === 'offline' && (
              <Banner kind="offline">
                Sovra's server can't be reached, so nothing here is current and scenarios can't run. Retrying every 8 seconds
              </Banner>
            )}
            {connection === 'stale' && (
              <Banner kind="stale">NEAR couldn't be reached just now. Showing the last known state; the vault still enforces its own rules</Banner>
            )}
            {vault?.is_frozen && (
              <Banner kind="frozen">Spending is frozen. Your agent can't pay anyone until you unfreeze</Banner>
            )}

            {!loaded ? (
              <LoadingHome />
            ) : (
              <>
                {currentScreen === 'home' && (
                  <HomeScreen
                    vault={vault}
                    agent={agent}
                    requests={requests}
                    events={events}
                    agentInfo={agentInfo}
                    testnetMode={testnetMode}
                    onOpenRequest={handleSelectRequest}
                    onNavigate={(s) => setCurrentScreen(s)}
                    onRunScenario={handleRunScenario}
                    scenarioRun={scenarioRun}
                    isScenarioRunning={isScenarioRunning}
                    onFund={handleFund}
                    onWithdraw={handleWithdraw}
                    lapsedHeldNear={lapsedRequest ? lapsedRequest.amount_near : 0}
                    onReleaseLapsed={handleReleaseLapsed}
                    fundBlockedReason={ownerBlockedReason}
                  />
                )}

                {currentScreen === 'agent' && (
                  <AgentMonitorScreen
                    agent={agent}
                    vault={vault}
                    requests={requests}
                    events={events}
                    agentInfo={agentInfo}
                    onRunScenario={handleRunScenario}
                    isScenarioRunning={isScenarioRunning}
                    scenarioRun={scenarioRun}
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
                    onOpenRequest={handleSelectRequest}
                    onNavigate={(screen) => setCurrentScreen(screen)}
                  />
                )}

                {currentScreen === 'limits' && (
                  <PolicyStudioScreen
                    vault={vault}
                    onUpdatePolicy={handleUpdatePolicy}
                    testnetMode={testnetMode}
                    ownerBlockedReason={ownerBlockedReason}
                    demoScale={agentInfo.demoScale}
                  />
                )}

                {currentScreen === 'activity' && <AuditTrailScreen events={events} requests={requests} onOpenRequest={handleSelectRequest} />}

                {currentScreen === 'settings' && <SettingsScreen vault={vault} health={health} agent={agent} />}
              </>
            )}
          </div>
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
      {currentScreen !== 'home' && currentScreen !== 'agent' && <ScenarioResultCard run={scenarioRun} onClose={() => setScenarioRun(null)} />}
      <TxToast />
    </div>
  );
}

/** Skeleton in the shape of Home while the vault is read for the first time. */
function LoadingHome() {
  return (
    <div className="flex flex-col gap-8" aria-label="Loading" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Skeleton className="h-[420px] rounded-card" />
        <Skeleton className="h-[420px] rounded-card" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    </div>
  );
}

export default App;
