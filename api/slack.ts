import { handleSlackWebhook } from '../lib/slack-ingress.js';

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

  const result = await handleSlackWebhook({
    env: process.env,
    rawBody,
    timestamp,
    signature
  });

  res.status(result.status).send(result.body);
}
