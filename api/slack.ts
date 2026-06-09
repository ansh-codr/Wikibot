import { handleSlackWebhook } from '../lib/slack-ingress.js';

export default async function handler(req: any, res: any): Promise<void> {
  // Handle Slack URL Verification challenge
  if (req.body && req.body.type === 'url_verification') {
    res.status(200).json({ challenge: req.body.challenge });
    return;
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const headers = req.headers ?? {};
  const timestamp = headers['x-slack-request-timestamp'] ?? headers['X-Slack-Request-Timestamp'] ?? '';
  const signature = headers['x-slack-signature'] ?? headers['X-Slack-Signature'] ?? '';

  const result = await handleSlackWebhook({
    env: process.env,
    rawBody,
    timestamp: String(timestamp),
    signature: String(signature)
  });

  res.status(result.status).send(result.body);
}
