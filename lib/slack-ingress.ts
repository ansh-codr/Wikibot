import { buildThreadJob, shouldProcessReaction, verifySlackSignature, type SlackEventEnvelope } from './slack-webhook.js';
import { loadWorkspaceConfig } from './config.js';
import { enqueueThreadJob } from './queue.js';

export type SlackWebhookResult =
  | { ok: true; status: number; body: string }
  | { ok: false; status: number; body: string };

export async function handleSlackWebhook(options: {
  env: Record<string, string | undefined>;
  rawBody: string;
  timestamp: string;
  signature: string;
}): Promise<SlackWebhookResult> {
  const { env, rawBody, timestamp, signature } = options;
  const signingSecret = env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return { ok: false, status: 500, body: 'missing Slack signing secret' };
  }

  if (!verifySlackSignature({ signingSecret, rawBody, timestamp, signature })) {
    return { ok: false, status: 401, body: 'invalid signature' };
  }

  let envelope: SlackEventEnvelope;

  try {
    envelope = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return { ok: false, status: 400, body: 'invalid payload' };
  }

  if (envelope.type !== 'event_callback' || envelope.event.type !== 'reaction_added') {
    return { ok: true, status: 200, body: 'ignored' };
  }

  const config = loadWorkspaceConfig(env, envelope.team_id);

  if (!shouldProcessReaction(envelope.event, config)) {
    return { ok: true, status: 200, body: 'ignored' };
  }

  const job = buildThreadJob(envelope);
  await enqueueThreadJob(job);

  return { ok: true, status: 200, body: 'queued' };
}
