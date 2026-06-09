import { Pool } from 'pg';

let pool: Pool | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDbPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = requireEnv('DATABASE_URL');
  pool = new Pool({ connectionString });
  return pool;
}
