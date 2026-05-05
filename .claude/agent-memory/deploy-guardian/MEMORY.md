# Deploy Guardian Memory

## Deploy Infrastructure (confirmed Mar 2026)
- **Production does NOT use Docker** — despite Dockerfile existing in repo
- **Backend:** rsync server/ → VPS (187.77.15.68:/var/www/monaco/server/), npm install, migrations, PM2 reload
- **Frontend:** npm run build locally, rsync dist/ → VPS (/var/www/monaco/dist/), nginx reload
- **Scripts:** `scripts/deploy-backend.sh` and `scripts/deploy-frontend.sh`
- **Process manager:** PM2 (process name: `monaco-api`, id: 3)
- **Web server:** nginx serves frontend static files + reverse proxy to backend
- **Note:** Two old `the-monaco` PM2 processes (id 0, 1) are in errored state — harmless, can be cleaned up

## Nginx Warnings (non-blocking)
- Nginx shows warnings about conflicting server names for `themonaco.com.co` and `www.themonaco.com.co`
- These are warnings only — `nginx -t` passes and reload succeeds
- Likely caused by duplicate server blocks in nginx config

## Freemium Model (deployed Mar 10, 2026)
- Free plan limits: 5 lavadas/month, 10 clientes (reduced from 50/30)
- Trial eliminated: new negocios start on 'free' plan
- Negocios created before 2026-03-01 grandfathered with 1-year PRO
- `start-trial` endpoint deprecated (returns 410)

## Component Reorganization (deployed Mar 10, 2026)
- Components moved from flat `src/components/` to subfolders:
  - `auth/` (Login, Register, Onboarding, SetupWizard)
  - `pages/` (Home, Lavadas, Clientes, Balance, Reportes, Configuracion, PagoTrabajadores, LandingPage + mockups)
  - `context/` (DataContext, TenantContext, ThemeContext, MoneyVisibilityContext)
  - `guards/` (RoleGuard, PlanGuard)
  - `layout/` (Layout, Toast, AppTour)
  - `shared/` (ServiceCard, NuevoServicioSheet, ConfirmDeleteModal, PasswordInput, Timer)
  - `payment/` (CheckoutModal, UpgradeModal, WompiWidget)
  - `ai/` (AiChat)
  - `Admin/` (AdminDashboard)
- Old files show as deleted in git status but were moved (not yet staged for deletion)

## Known Minor Issues
- `alert()` used in AdminDashboard.jsx (lines 117, 127) — should use Toast system
- Main JS chunk is 2.5MB — could benefit from code-splitting with dynamic imports
