import Groq from 'groq-sdk';
import { z } from 'zod';

import { ClaudeParseError, ClaudeValidationError } from './errors.js';
import type { SlackThreadMessage } from './types.js';

export const claudeSummarySchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  decisions: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

export type ClaudeSummary = z.infer<typeof claudeSummarySchema>;

type ClaudeCallResult = {
  output: ClaudeSummary;
  raw: string;
};

export async function summarizeThread(options: {
  apiKey: string;
  transcript: SlackThreadMessage[];
}): Promise<ClaudeCallResult> {
  const { apiKey, transcript } = options;
  const client = new Groq({ apiKey });
  const prompt = buildPrompt(transcript, false);

  const first = await callClaude(client, prompt);
  const parsed = parseClaudeJson(first);

  if (parsed.ok) {
    return { output: parsed.value, raw: first };
  }

  const retryPrompt = buildPrompt(transcript, true);
  const second = await callClaude(client, retryPrompt);
  const retryParsed = parseClaudeJson(second);

  if (retryParsed.ok) {
    return { output: retryParsed.value, raw: second };
  }

  throw retryParsed.error;
}

function buildPrompt(transcript: SlackThreadMessage[], strict: boolean): string {
  const intro =
    'You are a technical documentation specialist. Summarize the Slack thread into structured JSON.';
  const schema =
    '{"title": "", "summary": "", "decisions": [""], "actionItems": [""], "tags": [""]}';

  const rules = strict
    ? 'Return ONLY valid JSON. No prose. No markdown. No trailing commas.'
    : 'Return valid JSON only. No surrounding text.';

  const body = transcript
    .map((message) => `${message.authorName} (${message.timestamp}): ${message.text}`)
    .join('\n');

  return [intro, rules, `Schema: ${schema}`, 'Transcript:', body].join('\n\n');
}

async function callClaude(client: Groq, prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0]?.message?.content || '';

  return text.trim();
}

function parseClaudeJson(raw: string): { ok: true; value: ClaudeSummary } | { ok: false; error: Error } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: new ClaudeParseError(`Claude JSON parse failed: ${String(error)}`) };
  }

  const result = claudeSummarySchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: new ClaudeValidationError(`Claude output failed schema validation: ${result.error.message}`)
    };
  }

  return { ok: true, value: result.data };
}
