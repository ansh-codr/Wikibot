import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getDbPool } from './db.js';

async function readSqlFile(relativePath: string): Promise<string> {
  const fullPath = join(process.cwd(), relativePath);
  return readFile(fullPath, 'utf8');
}

export async function runMigrations(): Promise<void> {
  const pool = getDbPool();
  const sql = await readSqlFile('sql/migrations/001_idempotency.sql');

  await pool.query(sql);
}
