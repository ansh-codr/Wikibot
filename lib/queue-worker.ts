import { Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';

import { processThreadJob } from './process-thread.js';
import type { ThreadJob } from './types.js';

const QUEUE_NAME = 'thread-jobs';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function startQueueWorker(options?: { concurrency?: number; jobsOptions?: JobsOptions }): Worker {
  const redisUrl = requireEnv('REDIS_URL');
  const connection: ConnectionOptions = { url: redisUrl };

  const worker = new Worker<ThreadJob>(
    QUEUE_NAME,
    async (job) => processThreadJob(job.data),
    {
      connection,
      concurrency: options?.concurrency ?? 2
    }
  );

  return worker;
}
