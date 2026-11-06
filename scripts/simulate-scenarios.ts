/**
 * Throttle for NEAR: CLI Scenario Simulation Runner
 * Runs the 3 non-negotiable hackathon demo acceptance flows.
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

async function runScenario(name: 'routine' | 'spike' | 'injection') {
  console.log(`\n========================================`);
  console.log(`Executing Scenario: [${name.toUpperCase()}]`);
  console.log(`========================================`);

  const res = await fetch(`${API_BASE}/scenarios/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: name }),
  });

  const data = await res.json();
  console.log(`Outcome Status:`, data.requestStatus);
  console.log(`Risk Score:`, data.riskEvaluation?.composite_risk);
  console.log(`Authority Level:`, data.riskEvaluation?.authority_level, `(${data.riskEvaluation?.authority_name})`);
  console.log(`Reasons:`, data.riskEvaluation?.reasons);
  console.log(`Tx Hash:`, data.txHash || 'N/A (Held or Blocked)');
  console.log(`Message:`, data.message);
}

async function main() {
  console.log('Testing Throttle Scenarios against:', API_BASE);
  await runScenario('routine');
  await runScenario('spike');
  await runScenario('injection');
  console.log('\nAll demo scenarios completed.');
}

main().catch(console.error);

