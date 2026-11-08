/**
 * LLM task interpreter (Groq, OpenAI-compatible API).
 *
 * The model reads a completed task and its invoice and PROPOSES a recipient and
 * amount. It has no tools and cannot move money: its output is schema-validated
 * here, then scored by the deterministic risk engine and enforced by the vault.
 * Any failure (no key, timeout, HTTP error, invalid JSON or schema) falls back to
 * the task's scripted values, and the fallback reason is recorded.
 */
import { z } from 'zod';

export interface TaskForInterpretation {
  taskId: string;
  title: string;
  prompt: string;
  deliverableSummary: string;
  /** Free-text invoice / payment instruction the agent must interpret. */
  invoiceText?: string;
  /** Pre-extracted values used in scripted mode and as the fallback. */
  proposedPayee: string;
  proposedAmountNear: number;
}

export interface AgentProposal {
  recipient: string;
  amount_near: number;
  rationale: string;
  task_category: string;
  mode: 'llm' | 'scripted';
  model?: string;
  /** Why the scripted values were used instead of the model's (if they were). */
  fallback_reason?: string;
  latency_ms?: number;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const TIMEOUT_MS = 10_000;

// NEAR account ID rules: 2-64 chars, lowercase alphanumerics separated by - _ or .
const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export const ProposalSchema = z.object({
  recipient: z.string().trim().toLowerCase().regex(NEAR_ACCOUNT, 'recipient must be a NEAR account ID'),
  amount_near: z.coerce.number().positive().max(1000),
  rationale: z.string().trim().min(1).max(500),
  task_category: z.string().trim().min(1).max(60).default('uncategorized'),
});

const SYSTEM_PROMPT = [
  'You are the payment-proposal step of an autonomous agent that pays contractors for completed tasks on NEAR testnet.',
  'Read the task, the delivery summary and the invoice, and propose exactly one payment.',
  'You do not execute payments: a separate deterministic policy engine and an on-chain vault decide whether it is allowed.',
  'Respond with ONLY a JSON object with these keys:',
  '  "recipient": the payee NEAR account ID exactly as written in the invoice (e.g. "alice.testnet"),',
  '  "amount_near": the amount in NEAR as a number,',
  '  "rationale": one or two sentences explaining what is being paid for (max 240 characters),',
  '  "task_category": a short label such as "compute", "storage", "data", "diagnostics".',
].join('\n');

export function getAgentMode(): 'llm' | 'scripted' {
  return process.env.GROQ_API_KEY && process.env.AGENT_MODE !== 'scripted' ? 'llm' : 'scripted';
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
}

function scripted(task: TaskForInterpretation, fallbackReason?: string): AgentProposal {
  return {
    recipient: task.proposedPayee,
    amount_near: task.proposedAmountNear,
    rationale: `Scripted proposal for "${task.title}".`,
    task_category: 'scripted',
    mode: 'scripted',
    fallback_reason: fallbackReason,
  };
}

/** Pulls the first JSON object out of a model reply (tolerates code fences). */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in model reply');
  return JSON.parse(text.slice(start, end + 1));
}

export async function interpretTask(task: TaskForInterpretation): Promise<AgentProposal> {
  if (getAgentMode() === 'scripted') {
    return scripted(task, process.env.GROQ_API_KEY ? 'AGENT_MODE=scripted' : 'GROQ_API_KEY not set');
  }

  const model = getGroqModel();
  const user = [
    `Task ID: ${task.taskId}`,
    `Title: ${task.title}`,
    `Task description: ${task.prompt}`,
    `Delivery summary: ${task.deliverableSummary}`,
    `Invoice: ${task.invoiceText ?? `Pay ${task.proposedAmountNear} NEAR to ${task.proposedPayee}.`}`,
  ].join('\n');

  const started = Date.now();
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return scripted(task, `Groq HTTP ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = ProposalSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      return scripted(task, `Model output failed validation: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    return { ...parsed.data, mode: 'llm', model, latency_ms: Date.now() - started };
  } catch (err) {
    const e = err as Error;
    const reason = e.name === 'TimeoutError' ? `Groq timed out after ${TIMEOUT_MS} ms` : `Groq call failed: ${e.message}`;
    return scripted(task, reason);
  }
}
