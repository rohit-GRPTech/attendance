import { env } from '../config/env';
import { PostgresStore } from '../storage/postgres';
import { seedDemoData } from '../storage/seed';

/** Seeds the PostgreSQL database with the demo workspace (idempotent). */
async function seed(): Promise<void> {
  if (!env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to seed the database.');
    process.exit(1);
  }
  const store = new PostgresStore(env.DATABASE_URL);
  await store.init();
  await seedDemoData(store);
  await store.close();
  // eslint-disable-next-line no-console
  console.log('Seed complete. Sign in with maria@brightpath.co / Demo1234!');
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
