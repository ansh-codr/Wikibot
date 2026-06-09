import { Queue, type ConnectionOptions } from 'bullmq';

import type { ThreadJob } from './types.js';

const QUEUE_NAME = 'thread-jobs';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let queue: Queue | null = null;

function getQueue(): Queue {
  if (queue) {
    return queue;
  }

  const redisUrl = requireEnv('REDIS_URL');
  const connection: ConnectionOptions = { url: redisUrl };
  queue = new Queue(QUEUE_NAME, { connection });
  return queue;
}

export async function enqueueThreadJob(job: ThreadJob): Promise<void> {
  const jobId = `${job.workspaceId}:${job.channelId}:${job.threadTs}:${job.eventId}`;
  const queueInstance = getQueue();

  await queueInstance.add('process-thread', job, {
    jobId,
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}
