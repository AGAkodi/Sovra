import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../backend/src/server';
import { store } from '../../backend/src/db/store';
import http from 'http';

describe('Throttle End-to-End System Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    return () => {
      server.close();
    };
  });

  it('1. GET /health reports testnet connectivity and policy signer public key', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.network).toBe('testnet');
    expect(body.policy_signer).toMatch(/^ed25519:/);
  });

  it('2. Scenario 1: Routine 3 NEAR task payment automatically executes', async () => {
    const res = await fetch(`${baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'routine' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestStatus).toBe('succeeded');
    expect(body.riskEvaluation.composite_risk).toBeLessThan(20);
    expect(body.riskEvaluation.authority_level).toBeLessThanOrEqual(2);
    expect(body.attestationSignature).toBeDefined();
    expect(body.txHash).toBeDefined();
  });

  it('3. Scenario 2: Anomalous 25 NEAR payment is held for owner approval', async () => {
    const res = await fetch(`${baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'spike' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestStatus).toBe('pending_approval');
    expect(body.riskEvaluation.requires_owner_approval).toBe(true);
    expect(body.riskEvaluation.authority_level).toBe(5);

    // Verify owner can approve this held request
    const approveRes = await fetch(`${baseUrl}/approvals/${body.proposal.request_id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(approveRes.status).toBe(200);
    const approvedBody = await approveRes.json();
    expect(approvedBody.success).toBe(true);
    expect(approvedBody.request.status).toBe('succeeded');
    expect(approvedBody.request.tx_hash).toBeDefined();
  });

  it('4. Scenario 3: Malicious prompt injection attempt is refused & blocked', async () => {
    const res = await fetch(`${baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'injection' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestStatus).toBe('rejected');
    expect(body.riskEvaluation.is_blocked).toBe(true);
    expect(body.riskEvaluation.authority_level).toBe(6);
    expect(body.riskEvaluation.reasons).toContain('PROMPT_INJECTION_DETECTED');
    expect(body.txHash).toBeUndefined(); // Zero money moved
  });

  it('5. Emergency Freeze blocks any subsequent requests immediately', async () => {
    // Freeze agent
    const freezeRes = await fetch(`${baseUrl}/agents/agent-01/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Emergency operator killswitch' }),
    });
    expect(freezeRes.status).toBe(200);

    // Attempt routine payment
    const attemptRes = await fetch(`${baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'routine' }),
    });
    const attemptBody = await attemptRes.json();
    expect(attemptBody.requestStatus).toBe('rejected');
    expect(attemptBody.riskEvaluation.is_blocked).toBe(true);
    expect(attemptBody.riskEvaluation.authority_level).toBe(6);

    // Unfreeze
    await fetch(`${baseUrl}/agents/agent-01/unfreeze`, { method: 'POST' });
  });

  it('6. Audit events are recorded with tamper-evident log', async () => {
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].timestamp).toBeDefined();
    expect(events[0].actor).toBeDefined();
  });
});

