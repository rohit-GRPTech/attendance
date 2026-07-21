# Architecture overview

## The one-sentence version

AppForge stores every customer application as a **versioned, validated JSON definition**; the
**builder** edits draft definitions, the **runtime engine** renders published versions through a
**component registry**, and a single multi-tenant API serves every customer — no per-customer
code or deployments ever exist.

## Monorepo layout

```
appforge/
  apps/
    web/          React SPA: builder, dashboard, marketplace, portal runtime
    api/          Express API: auth, tenants, applications, records, workflows, AI, marketplace
  packages/
    shared/       The contract both sides depend on:
      branding.ts              central product branding
      constants.ts             statuses, categories, field types, plans, limits
      types/application.ts     ApplicationDefinition & friends (strict TS)
      schema/application-schema.ts  Zod validation + referential integrity checks
      schema/migrations.ts     schema version migrations, diff, clone-with-new-ids
      registry/component-registry.ts framework-free component metadata + prop schemas
      permissions/             pure permission evaluation (UX on web, authority on API)
      samples/                 3 demo application definitions (CRM, Inventory, Service Jobs)
  docs/
```

## Builder vs runtime — strict separation

- `apps/web/src/pages/builder/**` mutates a working copy of the draft definition via
  `useBuilderState` (undo/redo, debounced autosave to `PUT /applications/:id/definition`).
  Canvas previews are static and data-free.
- `apps/web/src/runtime/**` renders validated definitions with live data. It never mutates
  definitions. The preview page runs the draft through the same runtime; the portal runs the
  published immutable version.
- The API validates every saved draft and every publish with
  `validateWithRegistry` (Zod structure + referential integrity + registry membership),
  so an invalid definition can never be persisted or published (strict rule #15).

## Publishing lifecycle

```
draft definition ──save──▶ applications.draft_definition
       │ validate (schema + nav + data refs + workflows + roles)
       ▼
application_versions (immutable snapshot, version N)
       │ publish pointer
       ▼
applications.published_version_id ──▶ runtime resolution (/portal/...)
```

Rollback re-points `published_version_id` at any previous version.

## Request flow (runtime)

1. JWT bearer auth → user.
2. `X-Workspace` slug → tenant, **verified against a server-side membership row**.
3. `/portal/applications/:slug` loads the published version, validates it, filters navigation by
   the caller's app role and returns `{ definition, permissions }`.
4. Record CRUD (`/applications/:appId/entities/:entityKey/records`) re-derives the entity from
   the active definition, applies role/record-scope checks, validates payloads with a Zod schema
   generated from the entity fields (unknown keys stripped → mass-assignment safe), writes audit
   logs and dispatches workflows.

## Storage abstraction

`apps/api/src/storage/types.ts` defines the `Store` interface. Two implementations:

- `memory.ts` — development/preview store, auto-seeded with demo data.
- `postgres.ts` — Drizzle-based implementation over the schema in `src/db/schema.ts`
  (JSONB `records` table for dynamic entity data).

Every tenant-scoped method **requires** the tenantId argument; there is no unscoped variant.
Record filter/sort/search logic is shared (`record-filters.ts`) so both drivers behave identically.

## Adapters (swappable infrastructure)

- `adapters/ai/` — `AiApplicationGenerator` interface; `GeminiGenerator` + `MockGenerator`.
- `adapters/email.ts` — console driver; SMTP/provider slot behind the same interface.
- `adapters/file-storage.ts` — local-disk driver; S3-compatible slot.
- `adapters/billing.ts` — placeholder provider; Stripe-style checkout slot; plan limits come
  from the central `PLANS` constant only.

## Security posture (summary)

See [multi-tenant-security.md](multi-tenant-security.md). Highlights: bcrypt passwords, JWT
access + refresh, capability middleware from a central role→capability map, per-tenant query
scoping at the interface level, rate limiting, security headers, normalized error envelope with
no stack traces in production, plan-limit enforcement, audit logging on every significant action,
and a component/prop/workflow model with **no arbitrary code execution anywhere**.
