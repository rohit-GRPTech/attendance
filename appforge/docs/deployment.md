# Deployment guide

AppForge deploys as **one static frontend + one Node.js API + PostgreSQL**. No Docker required
(a Dockerfile can be added later; nothing assumes it).

## Build

```bash
cd appforge
npm install
npm run build
# → apps/api/dist/index.cjs   (self-contained API bundle)
# → apps/web/dist/            (static frontend)
```

## General VPS deployment (Ubuntu/Debian)

1. Install Node.js 20+ and PostgreSQL 14+.
2. Copy the repo (or just `apps/api/dist`, `apps/web/dist`, `apps/api/src/db/migrations`).
3. Create the database and run migrations/seed:
   ```bash
   npm run db:migrate && npm run db:seed   # or run migrations via psql from src/db/migrations
   ```
4. Configure the environment (systemd unit or `.env` next to the process):
   ```
   NODE_ENV=production
   PORT=4000
   STORAGE_DRIVER=postgres
   DATABASE_URL=postgres://appforge:...@localhost:5432/appforge
   JWT_SECRET=<long random string>
   CORS_ORIGINS=https://app.yourdomain.com
   WEB_BASE_URL=https://app.yourdomain.com
   ```
5. Run the API under a process manager:
   ```bash
   pm2 start apps/api/dist/index.cjs --name appforge-api
   # or a systemd service with Restart=always
   ```
   The server exposes `GET /health` for monitoring and shuts down gracefully on SIGTERM.
6. Nginx reverse proxy:
   ```nginx
   server {
     server_name app.yourdomain.com;
     root /var/www/appforge/web-dist;          # apps/web/dist
     index index.html;
     location /api/ { proxy_pass http://127.0.0.1:4000; proxy_set_header X-Forwarded-For $remote_addr; }
     location /health { proxy_pass http://127.0.0.1:4000; }
     location / { try_files $uri /index.html; }   # SPA fallback
   }
   ```
   The API sets `trust proxy`, so client IPs in rate limiting and audit logs stay accurate.

## Hostinger notes

- **VPS plans**: follow the VPS steps above — full Node.js + PostgreSQL support.
- **Shared/cloud hosting with Node.js support**: create a Node.js application pointing at
  `apps/api/dist/index.cjs`; set the environment variables in the panel (hPanel → Advanced →
  Node.js). Upload `apps/web/dist` to `public_html` and add an `.htaccess` SPA fallback:
  ```apache
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^(?!api/).* /index.html [L]
  RewriteRule ^api/(.*)$ http://127.0.0.1:4000/api/$1 [P,L]
  ```
- If managed PostgreSQL isn't available on your plan, use an external PostgreSQL
  (e.g. Neon/Supabase/managed DB) via `DATABASE_URL` — only outbound TCP is needed.
- Don't run `STORAGE_DRIVER=memory` in production: it is per-process and resets on restart.

## Checklist

- [ ] `JWT_SECRET` set to a unique random value (the server refuses the dev default)
- [ ] `CORS_ORIGINS` restricted to your real origin(s)
- [ ] HTTPS terminated at the proxy
- [ ] Database backups scheduled
- [ ] `GET /health` wired to uptime monitoring
