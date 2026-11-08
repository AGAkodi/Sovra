import React, { useState, useEffect, useCallback } from 'react';
import { api, Vault, Agent, PaymentRequest, AuditEvent, RiskEvaluation, Health } from './api/client';
import { Topbar } from './components/Topbar';
import { Sidebar, ScreenId } from './components/Sidebar';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { OverviewScreen } from './screens/OverviewScreen';
import { AgentMonitorScreen } from './screens/AgentMonitorScreen';
import { PaymentRequestsScreen } from './screens/PaymentRequestsScreen';
import { ApprovalCenterScreen } from './screens/ApprovalCenterScreen';
import { PolicyStudioScreen } from './screens/PolicyStudioScreen';
import { AuditTrailScreen } from './screens/AuditTrailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WalletProvider, useWallet } from './wallet/WalletContext';
import { TxToast } from './wallet/TxToast';
import { FundVaultControl } from './wallet/FundVaultControl';

const yoctoFromNear = (near: number) => (BigInt(Math.round(near * 1e6)) * 10n ** 18n).toString();

interface AppData {
  health: Health | null;
  vault: Vault | null;
  agent: Agent | null;
  requests: PaymentRequest[];
  events: AuditEvent[];
  isSyncing: boolean;
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
      if (vaultData) setVault(vaultData);
      if (agentsData && agentsData.length > 0) setAgent(agentsData[0]);
      if (requestsData) setRequests(requestsData);
      if (eventsData) setEvents(eventsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Data sync error:', err);
    } finally {
      setIsSyncing(false);
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
      <Shell data={{ health, vault, agent, requests, events, isSyncing, lastUpdated, fetchData }} />
    </WalletProvider>
  );
}

function Shell({ data }: { data: AppData }) {
  const { health, vault, agent, requests, events, isSyncing, lastUpdated, fetchData } = data;
  const wallet = useWallet();
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<RiskEvaluation | undefined>(undefined);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);

  const testnetMode = health?.chain_mode === 'testnet';
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
    try {
      await api.runScenario(scenario);
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
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

  const handleUpdatePolicy = async (policy: {
    perTxCapNear: number;
    dailyBudgetNear: number;
    requireWhitelist: boolean;
    maxRiskForAutonomous: number;
  }) => {
    await api.updatePolicy(policy);
    await fetchData();
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
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          pendingApprovalsCount={pendingApprovalsCount}
          isFrozen={Boolean(vault?.is_frozen)}
          onToggleFreeze={handleToggleFreeze}
          freezeBlockedReason={ownerBlockedReason}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full">
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

          {currentScreen === 'policies' && <PolicyStudioScreen vault={vault} onUpdatePolicy={handleUpdatePolicy} />}

          {currentScreen === 'audit' && <AuditTrailScreen events={events} />}

          {currentScreen === 'settings' && <SettingsScreen vault={vault} />}
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
      <TxToast />
    </div>
  );
}

export default App;
