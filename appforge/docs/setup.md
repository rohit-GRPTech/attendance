# Local setup & environment variables

## Prerequisites

- Node.js 20+ (22 recommended)
- npm 10+
- PostgreSQL 14+ (optional — the memory driver needs no database)

## Steps

```bash
cd appforge
npm install
npm run dev:api    # http://localhost:4000 (memory store, seeded demo data)
npm run dev:web    # http://localhost:5173 (proxies /api → :4000)
```

Sign in with `maria@brightpath.co` / `Demo1234!`.

## Environment variables

Copy `.env.example` to `apps/api/.env`. The API validates its environment with Zod on boot and
refuses to start with an invalid configuration (or with the default JWT secret in production).

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Standard Node environment |
| `PORT` | `4000` | API port |
| `API_BASE_URL` / `WEB_BASE_URL` | localhost URLs | Used in emails and CORS docs |
| `STORAGE_DRIVER` | `memory` | `memory` (auto-seeded) or `postgres` |
| `DATABASE_URL` | — | Required when `STORAGE_DRIVER=postgres` |
| `JWT_SECRET` | dev-only value | **Set a long random string in production** |
| `JWT_EXPIRES_IN` | `1h` | Access-token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | `30d` | Refresh-token lifetime |
| `AI_PROVIDER` | `mock` | `mock` or `gemini` |
| `GEMINI_API_KEY` | — | Server-side only, required for `gemini` |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model id |
| `EMAIL_DRIVER` | `console` | `console` logs emails; `smtp` reserved |
| `EMAIL_FROM` | `no-reply@appforge.local` | Sender address |
| `FILE_STORAGE_DRIVER` | `local` | `local` or `s3` (placeholder) |
| `FILE_STORAGE_LOCAL_DIR` | `./storage/uploads` | Local upload directory |
| `FILE_MAX_UPLOAD_MB` | `10` | Upload size limit |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `300` | Fixed-window rate limit |

## Useful scripts (repo root)

| Script | What it does |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Development servers |
| `npm run typecheck` | Strict TypeScript across all workspaces |
| `npm run build` | Production build: API bundle + web static assets |
| `npm run db:migrate` | Apply SQL migrations to PostgreSQL |
| `npm run db:seed` | Seed PostgreSQL with the demo workspace |
