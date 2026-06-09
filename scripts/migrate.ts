import { runMigrations } from '../lib/migrations.js';

try {
  await runMigrations();
  console.log('Migrations applied.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
}
