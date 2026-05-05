# Monaco PRO — Project Architect Memory

## Production Architecture (VPS, NOT Docker)
- **VPS IP:** 187.77.15.68 (root access via SSH)
- **Domain:** themonaco.com.co (certbot SSL, nginx redirects www -> non-www)
- **Frontend:** Static files at `/var/www/monaco/dist/` served by nginx
- **Backend:** PM2 process `monaco-api` at `/var/www/monaco/server/`, port 3001
- **Database:** PostgreSQL 16 native (NOT Docker), port 5432 on VPS
- **Proxy:** nginx does SPA fallback + `/api/` proxy to 3001 + `/socket.io/` WebSocket proxy
- **Docker files exist** (Dockerfile, docker-compose.yml) but are NOT used in production
- **db-tunnel.sh** maps local:5434 -> remote:54321 (may be outdated if DB is native on 5432)

## Deploy Process
- Two separate scripts: `scripts/deploy-backend.sh` and `scripts/deploy-frontend.sh`
- Backend: rsync server/ -> VPS, npm install, npm run migrate, PM2 reload
- Frontend: npm run build locally, rsync dist/ -> VPS, nginx reload
- Migration is idempotent (all CREATE IF NOT EXISTS)
- `.env` lives on VPS at `/var/www/monaco/server/.env` — never synced, manual edits

## Key Files
- `deploy/setup-vps.sh` — initial VPS setup script (PG16, Node20, PM2, nginx, certbot)
- `deploy/nginx-monaco.conf` — production nginx config with SSL
- `server/ecosystem.config.cjs` — PM2 config (fork mode, 256M max memory)

## Env Vars on VPS
Required: DATABASE_URL, JWT_SECRET, PORT, NODE_ENV, CORS_ORIGIN, WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET, WOMPI_INTEGRITY_SECRET, OPENAI_API_KEY
Optional (but should be set): FRONTEND_URL, RESEND_API_KEY, RESEND_FROM, OPENAI_MODEL

## Email Service (Resend)
- Uses fetch() to Resend REST API directly — NO `resend` npm package needed
- File: `server/src/services/emailService.js`
- Graceful fallback: logs reset URL to console if RESEND_API_KEY missing
- Temporary from: `onboarding@resend.dev` until domain verification
