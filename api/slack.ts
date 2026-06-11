import { processThreadJob } from '../lib/process-thread.js';
import {
  verifySlackSignature,
  shouldProcessReaction,
  buildThreadJob,
  type SlackEventEnvelope
} from '../lib/slack-webhook.js';
import { loadWorkspaceConfig } from '../lib/config.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any): Promise<void> {
  const rawBody = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const body = JSON.parse(rawBody || '{}');

  if (body.type === 'url_verification') {
    res.status(200).json({ challenge: body.challenge });
    return;
  }

  const headers = req.headers ?? {};
  const timestamp = String(headers['x-slack-request-timestamp'] ?? '');
  const signature = String(headers['x-slack-signature'] ?? '');

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    res.status(500).send('missing Slack signing secret');
    return;
  }

  if (!verifySlackSignature({ signingSecret, rawBody, timestamp, signature })) {
    res.status(401).send('invalid signature');
    return;
  }

  const envelope = body as SlackEventEnvelope;

  if (envelope.type !== 'event_callback' || envelope.event?.type !== 'reaction_added') {
    res.status(200).send('ignored');
    return;
  }

  const workspaceConfig = loadWorkspaceConfig(process.env as Record<string, string | undefined>, envelope.team_id);

  const shouldProcess = shouldProcessReaction(envelope.event, workspaceConfig);

  if (!shouldProcess) {
    res.status(200).send('ignored');
    return;
  }

  const job = buildThreadJob(envelope);

  // Process FIRST
  try {
    await processThreadJob(job);
  } catch (error) {
    console.error('Error processing thread:', error);
  }

  // THEN respond to Slack
  res.status(200).end('ok');
}
