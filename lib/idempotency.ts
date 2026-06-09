import { getDbPool } from './db.js';

export type IdempotencyResult = {
  allowed: boolean;
  status: 'started' | 'completed' | 'failed' | 'unknown';
};

export async function tryStartIdempotentJob(key: string): Promise<IdempotencyResult> {
  const pool = getDbPool();
  const result = await pool.query(
    `insert into idempotency_keys (key, status)
     values ($1, 'started')
     on conflict (key) do nothing
     returning status`,
    [key]
  );

  if (result.rowCount === 1) {
    return { allowed: true, status: 'started' };
  }

  const existing = await pool.query('select status from idempotency_keys where key = $1', [key]);
  const status = (existing.rows[0]?.status as IdempotencyResult['status']) ?? 'unknown';
  return { allowed: false, status };
}

export async function markJobCompleted(key: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `update idempotency_keys
     set status = 'completed', updated_at = now()
     where key = $1`,
    [key]
  );
}

export async function markJobFailed(key: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `update idempotency_keys
     set status = 'failed', updated_at = now()
     where key = $1`,
    [key]
  );
}
