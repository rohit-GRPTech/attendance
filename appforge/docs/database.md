# Database setup

## Creating the database

```bash
createdb appforge
createuser appforge --pwprompt
psql -c 'GRANT ALL PRIVILEGES ON DATABASE appforge TO appforge;'
```

Set in `apps/api/.env`:

```
STORAGE_DRIVER=postgres
DATABASE_URL=postgres://appforge:yourpassword@localhost:5432/appforge
```

## Migrations

SQL migrations live in `apps/api/src/db/migrations/` and are applied in filename order by a
small runner that records applied files in a `_migrations` table:

```bash
npm run db:migrate
```

`0001_init.sql` creates the full platform schema: `users`, `tenants`, `memberships`,
`invitations`, `applications`, `application_versions`, `records`, `workflow_runs`, `templates`,
`purchases`, `notifications`, `audit_logs`, `ai_generations`, `subscriptions`, `files`,
`feature_flags` — all tenant-owned tables carry an indexed `tenant_id`, timestamps and (where
appropriate) soft-delete columns. Dynamic application records use a JSONB `data` column with a
GIN index.

To add a migration, create `0002_your_change.sql` and run `npm run db:migrate` again.

## Seeding

```bash
npm run db:seed
```

Idempotent — it exits if the platform owner already exists. Creates the demo users, the
Brightpath Consulting workspace, three sample applications (two published), realistic CRM and
inventory records, marketplace templates, notifications, workflow runs and audit history.

## Drizzle schema

`apps/api/src/db/schema.ts` mirrors the SQL DDL with camelCase properties over snake_case
columns; the `PostgresStore` uses it for all queries. Record filtering currently loads the
tenant+application+entity slice and applies shared filter logic (identical to the memory driver);
the GIN index supports pushing filters into JSONB queries as a follow-up optimization.
