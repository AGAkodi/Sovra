import React, { useState, useEffect, useCallback } from 'react';
import { api, Vault, Agent, PaymentRequest, AuditEvent, RiskEvaluation } from './api/client';
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

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [vault, setVault] = useState<Vault | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<RiskEvaluation | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isScenarioRunning, setIsScenarioRunning] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [vaultData, agentsData, requestsData, eventsData] = await Promise.all([
        api.getVault().catch(() => null),
        api.getAgents().catch(() => []),
        api.getPaymentRequests().catch(() => []),
        api.getEvents().catch(() => []),
      ]);

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
      if (vault.is_frozen) {
        await api.unfreezeAgent(agent?.id || 'agent-01');
      } else {
        await api.freezeAgent(agent?.id || 'agent-01', 'Operator manual freeze action');
      }
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
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

  const handleApprove = async (id: string) => {
    await api.approveRequest(id);
    await fetchData();
  };

  const handleReject = async (id: string, reason: string) => {
    await api.rejectRequest(id, reason);
    await fetchData();
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

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col font-sans">
      <Topbar
        onRefresh={fetchData}
        lastUpdated={lastUpdated}
        isSyncing={isSyncing}
        vaultContractId={vault?.contract_id}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          pendingApprovalsCount={pendingApprovalsCount}
          isFrozen={Boolean(vault?.is_frozen)}
          onToggleFreeze={handleToggleFreeze}
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

          {currentScreen === 'payments' && (
            <PaymentRequestsScreen
              requests={requests}
              onSelectRequest={handleSelectRequest}
            />
          )}

          {currentScreen === 'approvals' && (
            <ApprovalCenterScreen
              requests={requests}
              vault={vault}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {currentScreen === 'policies' && (
            <PolicyStudioScreen
              vault={vault}
              onUpdatePolicy={handleUpdatePolicy}
            />
          )}

          {currentScreen === 'audit' && (
            <AuditTrailScreen events={events} />
          )}

          {currentScreen === 'settings' && (
            <SettingsScreen vault={vault} />
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
    </div>
  );
}

export default App;

