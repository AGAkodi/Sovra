/** Demo scenario amounts and agent mode, as reported by the backend's /health. */
export interface AgentInfo {
  mode: 'llm' | 'scripted';
  model: string | null;
  demoScale: number;
}

export const DEFAULT_AGENT_INFO: AgentInfo = { mode: 'scripted', model: null, demoScale: 1 };

const REFERENCE = { routine: 3, spike: 25, injection: 80 } as const;

/** Scenario amounts at the backend's DEMO_SCALE, formatted for labels (e.g. "0.3 NEAR"). */
export function scenarioAmount(scenario: keyof typeof REFERENCE, scale: number): string {
  return `${Math.round(REFERENCE[scenario] * scale * 1e6) / 1e6} NEAR`;
}

export function agentModeLabel(info: AgentInfo): string {
  return info.mode === 'llm' ? `LLM agent (Groq · ${info.model ?? 'model'})` : 'Scripted agent (no LLM configured)';
}
