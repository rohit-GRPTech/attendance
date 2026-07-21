# AppForge

**Build business software in a day.** AppForge is a multi-tenant low-code SaaS platform where
teams visually build, publish and sell small business systems — CRMs, inventory trackers,
field-service managers — from reusable components, without writing code.

> The product name and branding live in one place: `packages/shared/src/branding.ts`.

## What's inside

| Layer | Location | Stack |
|---|---|---|
| Web app | `apps/web` | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, dnd-kit, React Flow, Recharts |
| API | `apps/api` | Node.js, Express, TypeScript, Zod, JWT auth, Drizzle ORM, PostgreSQL (or in-memory dev store) |
| Shared core | `packages/shared` | Application-definition types, Zod schema validator, schema migrations, component registry, permission evaluator, demo app definitions |

Key capabilities in this MVP:

- **Visual builder** — pages, drag-to-reorder components, properties panel, entity (data table)
  designer, theme, autosave, undo/redo, validation, publish with immutable versions and rollback.
- **Runtime engine** — published JSON definitions are validated and rendered through a component
  registry at `/portal/:tenantSlug/:appSlug/:pageSlug` with role-filtered navigation and full
  record CRUD. No customer code is ever executed.
- **Multi-tenancy** — every record carries a `tenant_id`; the active tenant is resolved from the
  authenticated membership, never trusted from the client.
- **Workflows** — declarative node-based automations (React Flow editor) executed server-side
  with run history and audit entries.
- **AI generation** — provider-agnostic `AiApplicationGenerator` interface with a Gemini adapter
  and a deterministic mock; all AI output is schema-validated before saving.
- **Marketplace** — publish applications as templates (structure only, never customer data),
  install/purchase them into any workspace, seller dashboard.
- **Platform features** — auth suite, workspace members & invitations, notifications, audit logs,
  plans/usage/billing placeholder, demo seed data.

## Quick start (no database needed)

```bash
cd appforge
npm install

# Terminal 1 — API with the in-memory store (auto-seeded demo data)
npm run dev:api

# Terminal 2 — web app (proxies /api to :4000)
npm run dev:web
```

Open http://localhost:5173 and sign in with a demo account (password `Demo1234!`):

| Email | Role |
|---|---|
| `maria@brightpath.co` | Tenant owner, template creator |
| `daniel@brightpath.co` | Tenant admin |
| `priya@brightpath.co` | Application user (portal only) |
| `owner@appforge.dev` | Platform owner |

The demo workspace **Brightpath Consulting** ships with a published Simple CRM, a published
Inventory Management app, a draft Service Job Management app, realistic records, marketplace
templates, notifications, workflow runs and audit history.

## Using PostgreSQL

```bash
cp .env.example apps/api/.env
# set STORAGE_DRIVER=postgres and DATABASE_URL=postgres://...
npm run db:migrate     # applies SQL migrations from apps/api/src/db/migrations
npm run db:seed        # optional demo data
npm run dev:api
```

## Production build

```bash
npm run build          # shared typecheck + API bundle (dist/index.cjs) + web static build (dist/)
node apps/api/dist/index.cjs           # serve the API
# serve apps/web/dist behind any static host / reverse proxy (see docs/deployment.md)
```

## Documentation

- [Architecture overview](docs/architecture.md)
- [Local setup & environment variables](docs/setup.md)
- [Database setup & migrations](docs/database.md)
- [Application JSON schema](docs/application-schema.md)
- [Component registry](docs/component-registry.md)
- [Workflow engine](docs/workflow-engine.md)
- [Permissions model](docs/permissions.md)
- [Multi-tenant security](docs/multi-tenant-security.md)
- [Marketplace workflow](docs/marketplace.md)
- [AI generation](docs/ai-generation.md)
- [Deployment (VPS & Hostinger)](docs/deployment.md)
