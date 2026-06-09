import { processThreadJob } from '../lib/process-thread.js';

export default async function handler(req: any, res: any): Promise<void> {
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const result = await processThreadJob(payload);

  res.status(result.ok ? 200 : 500).json(result);
}
