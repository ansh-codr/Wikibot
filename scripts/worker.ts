import { startQueueWorker } from '../lib/queue-worker.js';
import { runMigrations } from '../lib/migrations.js';

try {
  await runMigrations();
  console.log('Migrations applied.');

  const worker = startQueueWorker();
  console.log('Worker started.');

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Worker startup failed:', error);
  process.exit(1);
}
