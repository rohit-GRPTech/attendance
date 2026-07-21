import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env';

/** Applies SQL migrations in order, tracking them in a _migrations table. */
async function migrate(): Promise<void> {
  if (!env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to run migrations.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');

  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Applying ${file}...`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
  await pool.end();
  // eslint-disable-next-line no-console
  console.log('Migrations complete.');
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
