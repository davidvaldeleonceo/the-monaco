# Plan de Reorganización del Proyecto Monaco PRO

## Diagnóstico: Estado Actual

```
the-monaco/                         ← RAÍZ (37 items — mucho ruido)
├── .agent/                          ⚠️ Metadata de Claude skills (symlinks)
├── .agents/                         ⚠️ Metadata de Claude skills
├── .claude/                         ✅ Config Claude Code
├── .cursor/                         ✅ Config Cursor IDE
├── .git/                            ✅ Git
├── .vercel/                         ⚠️ Legacy Vercel (ya no se usa, deploy es VPS)
├── .vscode/                         ✅ VS Code (no trackeado en git)
├── deploy/                          ✅ Infra (nginx, setup VPS)
├── dist/                            ✅ Build output (gitignored)
├── landingpage/imagenes/            ⚠️ 22 imágenes duplicadas con public/img/
├── node_modules/                    ✅ Deps
├── public/                          ✅ Assets PWA
│   └── img/                         ⚠️ 19 imágenes de landing page duplicadas
├── scripts/                         ✅ Deploy scripts
├── server/                          ✅ Backend Express
│   └── src/db/exported/             ⚠️ 13 JSONs legacy de migración Supabase
├── skills/                          ⚠️ Symlinks de Claude skills
├── src/                             ⚠️ Frontend — FLAT, 28 componentes en 1 carpeta
│   ├── Copia de components          ❌ Archivo vacío basura (0 bytes)
│   ├── components/                  ⚠️ Todo plano: pages, contexts, modals, guards mezclados
│   │   ├── Admin/                   ✅ Única subcarpeta
│   │   └── common/                  ✅ 3 componentes comunes
│   ├── App.css                      ⚠️ 12,823 líneas — MONOLÍTICO
│   └── supabaseClient.js            ⚠️ Nombre legacy (ya no usa Supabase)
├── supabase/                        ❌ Legacy Supabase migration (obsoleto)
├── .dockerignore                    ✅
├── .gitignore                       ✅ (ya ignora ssh_tunnel*.log, exported/, etc.)
├── .vercelignore                    ⚠️ Legacy
├── ARCHITECTURE.md                  ✅ Documentación del sistema
├── Dockerfile                       ✅
├── README.md                        ✅
├── docker-compose.yml               ✅
├── eslint.config.js                 ✅
├── index.html                       ✅
├── package.json                     ✅
├── package-lock.json                ✅
├── plan.md                          ⚠️ Plan viejo del tour (obsoleto)
├── skills-lock.json                 ⚠️ Claude skills metadata
├── ssh_tunnel.log                   ❌ Log suelto (ya en gitignore)
├── ssh_tunnel_prod.log              ❌ Log suelto (ya en gitignore)
├── test-db.js                       ⚠️ Utility suelto en raíz
├── vercel.json                      ⚠️ Legacy Vercel
└── vite.config.js                   ✅
```

### Problemas Identificados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **`src/components/` es PLANO** — 28 .jsx mezclados (páginas, contextos, modals, guards) | Difícil encontrar archivos, no hay jerarquía visual |
| 2 | **`App.css` tiene 12,823 líneas** en un solo archivo | Imposible mantener, merge conflicts constantes |
| 3 | **Archivos legacy** — `supabase/`, `.vercel/`, `vercel.json`, `.vercelignore`, `plan.md` | Confusión, no se usan |
| 4 | **Basura** — `Copia de components` (0 bytes), `ssh_tunnel*.log`, `test-db.js` en raíz | Ruido visual |
| 5 | **Imágenes duplicadas** — `landingpage/imagenes/` y `public/img/` tienen las mismas fotos | 6.2MB desperdiciados |
| 6 | **`supabaseClient.js`** — nombre legacy cuando ya no usa Supabase | Confusión para nuevos devs |
| 7 | **`server/src/db/exported/`** — 13 JSONs de migración Supabase (one-time use) | 450KB de datos innecesarios |
| 8 | **Componentes gigantes** — Home (3,960 loc), Configuracion (2,134), Clientes (1,754) | Mantenibilidad difícil |

---

## Plan de Reorganización

### FASE 1: Limpieza — Eliminar basura y legacy (5 min, riesgo: NULO)

**Archivos a eliminar:**

```bash
# Archivo vacío basura
rm "src/Copia de components"

# Logs sueltos (ya en gitignore pero aún existen)
rm ssh_tunnel.log ssh_tunnel_prod.log

# Legacy Supabase (ya migraste a PostgreSQL propio)
rm -rf supabase/

# Legacy Vercel (deploy es VPS con rsync, no Vercel)
rm -rf .vercel/
rm vercel.json
rm .vercelignore

# Plan viejo que ya no aplica
rm plan.md

# Test utility que debería estar en server/
mv test-db.js server/test-db.js
```

**Resultado:** La raíz pasa de 37 items a ~25.

---

### FASE 2: Reorganizar `src/components/` en subcarpetas (15 min, riesgo: BAJO)

**Estado actual (plano, 28 archivos mezclados):**
```
src/components/
├── Admin/AdminDashboard.jsx    ← única subcarpeta existente
├── common/                     ← 3 componentes
├── AiChat.jsx                  ← ¿IA? ¿modal? ¿page?
├── AppTour.jsx                 ← ¿flow? ¿layout?
├── Balance.jsx                 ← PÁGINA
├── CheckoutModal.jsx           ← MODAL de pago
├── Clientes.jsx                ← PÁGINA
├── Configuracion.jsx           ← PÁGINA
├── DataContext.jsx              ← CONTEXT
├── Home.jsx                    ← PÁGINA
├── LandingPage.jsx             ← PÁGINA
├── Lavadas.jsx                 ← PÁGINA
├── Layout.jsx                  ← LAYOUT
├── Login.jsx                   ← AUTH
├── Membresias.jsx              ← FEATURE
├── MoneyVisibilityContext.jsx   ← CONTEXT
├── NuevoServicioSheet.jsx       ← MODAL shared
├── Onboarding.jsx               ← AUTH FLOW
├── PagoTrabajadores.jsx         ← PÁGINA
├── PlanGuard.jsx                ← GUARD
├── Register.jsx                 ← AUTH
├── Reportes.jsx                 ← PÁGINA
├── RoleGuard.jsx                ← GUARD
├── ServiceCard.jsx              ← SHARED
├── SetupWizard.jsx              ← AUTH FLOW
├── Tareas.jsx                   ← FEATURE
├── TenantContext.jsx            ← CONTEXT
├── ThemeContext.jsx              ← CONTEXT
├── Toast.jsx                    ← LAYOUT/UI
├── UpgradeModal.jsx             ← MODAL pago
└── WompiWidget.jsx              ← PAYMENT
```

**Estructura propuesta (categorizada):**

```
src/components/
│
├── pages/                      ← Componentes de ruta (1 por ruta del router)
│   ├── Home.jsx                   3,960 líneas — dashboard principal
│   ├── Lavadas.jsx                  999 líneas — CRUD lavadas
│   ├── Clientes.jsx               1,754 líneas — gestión clientes
│   ├── Reportes.jsx               1,535 líneas — analytics/charts
│   ├── PagoTrabajadores.jsx       1,713 líneas — nómina
│   ├── Configuracion.jsx          2,134 líneas — settings
│   ├── Balance.jsx                  884 líneas — balance financiero
│   └── LandingPage.jsx             428 líneas — marketing page
│
├── auth/                       ← Login, registro, onboarding
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Onboarding.jsx
│   └── SetupWizard.jsx
│
├── context/                    ← React Contexts (providers globales)
│   ├── DataContext.jsx
│   ├── TenantContext.jsx
│   ├── ThemeContext.jsx
│   └── MoneyVisibilityContext.jsx
│
├── guards/                     ← Route/feature protection
│   ├── RoleGuard.jsx
│   └── PlanGuard.jsx
│
├── payment/                    ← Todo lo de Wompi/suscripciones
│   ├── CheckoutModal.jsx
│   ├── WompiWidget.jsx
│   └── UpgradeModal.jsx
│
├── ai/                         ← IA Monaco
│   └── AiChat.jsx
│
├── layout/                     ← Estructura visual de la app
│   ├── Layout.jsx
│   ├── Toast.jsx
│   └── AppTour.jsx
│
├── shared/                     ← Componentes reutilizables (renombrar common/)
│   ├── ConfirmDeleteModal.jsx     (de common/)
│   ├── PasswordInput.jsx          (de common/)
│   ├── Timer.jsx                  (de common/)
│   ├── ServiceCard.jsx
│   └── NuevoServicioSheet.jsx
│
├── features/                   ← Módulos de features específicas
│   ├── Membresias.jsx
│   └── Tareas.jsx
│
└── Admin/                      ← Panel superadmin (ya existe)
    └── AdminDashboard.jsx
```

**Imports a actualizar:** ~50 imports en App.jsx y entre componentes.

Ejemplo:
```js
// ANTES
import Home from './components/Home'
import { DataProvider } from './components/DataContext'
import RoleGuard from './components/RoleGuard'

// DESPUÉS
import Home from './components/pages/Home'
import { DataProvider } from './components/context/DataContext'
import RoleGuard from './components/guards/RoleGuard'
```

---

### FASE 3: Renombrar `supabaseClient.js` (5 min, riesgo: BAJO)

```
src/supabaseClient.js → src/apiClient.js
```

Actualizar todos los imports (el export `supabase` se mantiene para no cambiar código interno):
```js
// ANTES
import { supabase } from './supabaseClient'
import { supabase } from '../supabaseClient'

// DESPUÉS
import { supabase } from './apiClient'
import { supabase } from '../apiClient'
```

---

### FASE 4: Consolidar imágenes de landing page (5 min, riesgo: NULO)

**Situación:** Las imágenes están duplicadas:
- `landingpage/imagenes/` — 22 archivos: `3.png`, `4.png`... + `imagen 1.png`, `imagen 2.png`
- `public/img/` — 19 archivos: `step-3.png`, `step-4.png`... + `hero-phone.png`

`LandingPage.jsx` referencia las de `public/img/` (las rutas `/img/step-3.png`).

**Acción:**
```bash
# Eliminar carpeta duplicada — public/img/ es la que se usa
rm -rf landingpage/
```

---

### FASE 5: Organizar CSS (30-60 min, riesgo: MEDIO)

`App.css` = **12,823 líneas**. Dos opciones:

#### Opción A — Split por categoría (recomendada, menor riesgo)

```
src/styles/
├── variables.css      ← Variables CSS, colores, dark mode tokens
├── base.css           ← Reset, tipografía, scrollbar, animations
├── layout.css         ← Sidebar, navbar, bottom bar, grid, responsive
├── pages.css          ← Estilos específicos de páginas (home, lavadas, etc.)
├── components.css     ← Cards, modals, forms, buttons, badges
├── landing.css        ← Landing page
└── utilities.css      ← Helpers (.hidden, .flex-center, .text-truncate, etc.)
```

En `main.jsx`:
```js
import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/pages.css'
import './styles/components.css'
import './styles/landing.css'
```

#### Opción B — CSS Modules por componente (más trabajo, mejor a largo plazo)

```
src/components/pages/Home.jsx     → src/components/pages/Home.module.css
src/components/pages/Lavadas.jsx  → src/components/pages/Lavadas.module.css
```

> **Recomendación:** Opción A como primer paso. Es mecánica (cortar y pegar secciones del CSS) y no cambia clases.

---

### FASE 6: Limpiar server legacy (5 min, riesgo: NULO)

```bash
# Scripts de migración one-time desde Supabase (ya completados)
rm server/src/db/export-supabase.js
rm server/src/db/import-via-api.js
rm -rf server/src/db/exported/     # 13 JSONs de datos exportados
```

Mantener `import-data.js` si aún lo usas para importar datos.

---

## Estructura Final Propuesta

```
the-monaco/
│
│  ── Configuración ──────────────────
├── .gitignore
├── .dockerignore
├── eslint.config.js
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
│
│  ── Docker ──────────────────────────
├── Dockerfile
├── docker-compose.yml
│
│  ── Documentación ───────────────────
├── ARCHITECTURE.md
├── README.md
│
│  ── Infraestructura ─────────────────
├── deploy/
│   ├── nginx-http.conf
│   ├── nginx-monaco.conf
│   └── setup-vps.sh
│
├── scripts/
│   ├── db-tunnel.sh
│   ├── deploy-backend.sh
│   └── deploy-frontend.sh
│
│  ── Assets estáticos ────────────────
├── public/
│   ├── img/                  Screenshots de landing
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── robots.txt
│   └── sitemap.xml
│
│  ── BACKEND ─────────────────────────
├── server/
│   ├── package.json
│   ├── test-db.js
│   └── src/
│       ├── index.js
│       ├── config/
│       │   ├── database.js       Pool pg + DATE timezone fix
│       │   ├── env.js            Validación env vars
│       │   └── logger.js         Logger producción
│       ├── middleware/
│       │   ├── auth.js           JWT verification
│       │   ├── errorHandler.js   Error handler global
│       │   ├── planLimits.js     Límites plan free
│       │   ├── superadmin.js     Verificación superadmin
│       │   └── tenantScope.js    Aislamiento multi-tenant
│       ├── routes/
│       │   ├── admin.js          Panel superadmin
│       │   ├── ai.js             Chat IA + transcripción
│       │   ├── auth.js           Login/signup/update
│       │   ├── crud.js           API CRUD genérica
│       │   ├── rpc.js            Procedimientos (crear negocio)
│       │   └── wompi.js          Pagos Wompi
│       ├── services/
│       │   ├── aiPrompt.js       System prompt IA
│       │   ├── aiService.js      Chat loop OpenAI
│       │   ├── aiTools.js        12 tools + SQL queries
│       │   ├── authService.js    Hash/JWT/compare
│       │   ├── joinResolver.js   Resuelve JOINs del select
│       │   ├── queryBuilder.js   SQL desde query params
│       │   └── realtimeService.js Socket.io init
│       └── db/
│           ├── migrate.js        Ejecuta schema.sql
│           ├── schema.sql        Schema completo + indexes
│           ├── seed.js           Datos semilla
│           └── import-data.js    Import de datos
│
│  ── FRONTEND ────────────────────────
└── src/
    ├── main.jsx              React entry point
    ├── App.jsx               Routing + auth flow
    ├── App.css               Estilos (o src/styles/)
    ├── index.css             Base CSS
    ├── apiClient.js          Adaptador API (ex supabaseClient.js)
    │
    ├── assets/
    │   └── react.svg
    │
    ├── config/
    │   ├── constants.js      API_URL, TOKEN_KEY
    │   └── tourSteps.js      App tour definitions
    │
    ├── hooks/
    │   └── useServiceHandlers.js
    │
    ├── utils/
    │   ├── date.js           Timezone conversion
    │   └── money.js          Currency formatting
    │
    └── components/
        │
        ├── pages/            ── Componentes de ruta ──
        │   ├── Home.jsx             Dashboard principal
        │   ├── Lavadas.jsx          CRUD lavadas + estados
        │   ├── Clientes.jsx         Gestión de clientes
        │   ├── Reportes.jsx         Charts y analytics
        │   ├── PagoTrabajadores.jsx Nómina trabajadores
        │   ├── Configuracion.jsx    Settings del negocio
        │   ├── Balance.jsx          Balance financiero
        │   └── LandingPage.jsx      Marketing page
        │
        ├── auth/             ── Login + registro ──
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Onboarding.jsx       Crear negocio
        │   └── SetupWizard.jsx      Config inicial
        │
        ├── context/          ── React Contexts ──
        │   ├── DataContext.jsx          Fetching + realtime
        │   ├── TenantContext.jsx        Negocio/perfil/plan
        │   ├── ThemeContext.jsx         Dark mode
        │   └── MoneyVisibilityContext.jsx  Blur montos
        │
        ├── guards/           ── Protección de rutas ──
        │   ├── RoleGuard.jsx        Por rol
        │   └── PlanGuard.jsx        Por plan (PRO)
        │
        ├── payment/          ── Wompi + suscripciones ──
        │   ├── CheckoutModal.jsx    Modal de pago
        │   ├── WompiWidget.jsx      Widget checkout
        │   └── UpgradeModal.jsx     Upsell a PRO
        │
        ├── ai/               ── Asistente IA ──
        │   └── AiChat.jsx           Chat texto + voz
        │
        ├── layout/           ── Estructura visual ──
        │   ├── Layout.jsx           Sidebar + navbar
        │   ├── Toast.jsx            Notificaciones
        │   └── AppTour.jsx          Tour onboarding
        │
        ├── shared/           ── Reutilizables ──
        │   ├── ConfirmDeleteModal.jsx
        │   ├── PasswordInput.jsx
        │   ├── Timer.jsx
        │   ├── ServiceCard.jsx
        │   └── NuevoServicioSheet.jsx
        │
        ├── features/         ── Módulos de features ──
        │   ├── Membresias.jsx
        │   └── Tareas.jsx
        │
        └── Admin/            ── Panel superadmin ──
            └── AdminDashboard.jsx
```

---

## Resumen de Esfuerzo

| Fase | Descripción | Tiempo | Riesgo | Impacto |
|------|------------|--------|--------|---------|
| **1** | Limpiar basura y legacy | 5 min | Nulo | Raíz limpia |
| **2** | Reorganizar components/ en subcarpetas | 15 min | Bajo | **ALTO — principal mejora** |
| **3** | Renombrar supabaseClient → apiClient | 5 min | Bajo | Claridad |
| **4** | Consolidar imágenes landing | 5 min | Nulo | -6.2MB |
| **5** | Split CSS monolítico (opcional) | 30-60 min | Medio | Mantenibilidad |
| **6** | Limpiar server legacy | 5 min | Nulo | Menos ruido |

**Total: ~35 min** (fases 1-4 + 6) o **~90 min** (con CSS split)

---

## Orden de Ejecución

1. **Hacer commit** del estado actual (backup)
2. **Fase 1** → commit: `chore: remove legacy and cleanup files`
3. **Fase 4** → commit: `chore: consolidate landing page images`
4. **Fase 6** → commit: `chore: remove legacy migration scripts`
5. **Fase 2** → commit: `refactor: organize components into categories`
6. **Fase 3** → commit: `refactor: rename supabaseClient to apiClient`
7. **Fase 5** (si decides) → commit: `refactor: split monolithic CSS`

> Fases 1, 4, 6 son seguras (no rompen nada). Fase 2 requiere actualizar imports pero es mecánica. Fase 5 es la más delicada.

---

## Notas

- **El backend (`server/src/`) ya está bien organizado** — no necesita cambios
- **No mover archivos config de la raíz** (vite.config.js, Dockerfile, etc.)
- **Actualizar ARCHITECTURE.md** después de reorganizar
- **Probar `npm run build` y `npm run dev`** después de cada fase para verificar que nada se rompió
