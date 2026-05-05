# Monaco PRO — Arquitectura Completa del Sistema

> Sistema de gestión para lavaderos de motos en Colombia. SaaS multi-tenant con IA integrada.
> Dominio: `themonaco.com.co` | VPS: `187.77.15.68`

---

## 1. Vista General

Monaco PRO es un **monorepo** que contiene dos proyectos principales y un módulo de infraestructura:

```
/the-monaco/
├── src/                   # PROYECTO 1: Frontend (React SPA + PWA)
│   ├── components/        # 28 componentes React
│   ├── config/            # Constantes (API_URL, TOKEN_KEY)
│   ├── utils/             # Helpers (date.js, formatters)
│   ├── App.jsx            # Entry point + routing
│   ├── App.css            # Estilos globales
│   └── supabaseClient.js  # Adaptador API (drop-in Supabase replacement)
│
├── server/                # PROYECTO 2: Backend API (Express + PostgreSQL)
│   └── src/
│       ├── config/        # env.js, database.js, logger.js
│       ├── db/            # schema.sql, migrate.js, seed.js
│       ├── middleware/    # auth, tenantScope, planLimits, superadmin, errorHandler
│       ├── routes/        # auth, crud, rpc, wompi, ai, admin
│       ├── services/      # authService, queryBuilder, joinResolver, aiService, aiTools, aiPrompt, realtimeService
│       └── index.js       # Express app entry point
│
├── deploy/                # MÓDULO 3: Infraestructura
│   ├── nginx-monaco.conf  # Configuración nginx (reverse proxy + SSL)
│   └── setup-vps.sh       # Script setup VPS (PostgreSQL, Node, PM2, nginx, Certbot)
│
├── scripts/               # Scripts de despliegue
│   ├── deploy-frontend.sh # Build + rsync dist/ al VPS
│   └── deploy-backend.sh  # rsync server/ + npm install + pm2 reload
│
├── Dockerfile             # Multi-stage: build frontend → production server
├── docker-compose.yml     # PostgreSQL 16 + app (dev local / producción)
├── vite.config.js         # Vite + PWA + proxy + code splitting
├── package.json           # Frontend deps (React 19, Recharts, Socket.io-client)
└── index.html             # SPA entry point
```

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Frontend** | React + Vite + PWA (VitePWA) | React 19.2, Vite 7.2 |
| **UI** | Lucide React, React DatePicker, React Select | lucide 0.562 |
| **Charts** | Recharts | 3.7 |
| **Exportación** | jsPDF, ExcelJS, xlsx, file-saver | - |
| **Realtime (client)** | Socket.io Client | 4.8 |
| **Backend** | Express.js | 4.21 |
| **Base de datos** | PostgreSQL (self-hosted) | 16 |
| **Auth** | JWT (jsonwebtoken) + bcrypt | jwt 9.0, bcrypt 5.1 |
| **Realtime (server)** | Socket.io Server | 4.8 |
| **Pagos** | Wompi (procesador colombiano) | API v1 |
| **IA Chat** | OpenAI GPT-5.3 (`gpt-5.3-chat-latest`) | Configurable via `OPENAI_MODEL` |
| **IA Voz** | OpenAI Whisper-1 | - |
| **Upload** | Multer (memory storage) | 2.1 |
| **Deploy** | Docker, nginx, PM2, Certbot | Node 20 Alpine |

### Dependencias Frontend (`package.json`)

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.12.0",
  "recharts": "^3.7.0",
  "lucide-react": "^0.562.0",
  "socket.io-client": "^4.8.1",
  "react-datepicker": "^9.1.0",
  "react-select": "^5.10.2",
  "exceljs": "^4.4.0",
  "jspdf": "^4.1.0",
  "jspdf-autotable": "^5.0.7",
  "xlsx": "^0.18.5",
  "file-saver": "^2.0.5"
}
```

### Dependencias Backend (`server/package.json`)

```json
{
  "express": "^4.21.2",
  "pg": "^8.13.1",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "socket.io": "^4.8.1",
  "multer": "^2.1.1"
}
```

---

## 3. Arquitectura Multi-Tenant

Cada **negocio** (lavadero de motos) = un **tenant**. Toda tabla de datos de negocio tiene `negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE`.

### Aislamiento de Datos

```
Request → auth.js (JWT → user.negocio_id)
        → tenantScope.js (inyecta negocio_id en queries)
        → planLimits.js (verifica límites del plan)
        → crud.js (ejecuta query filtrada por tenant)
```

**Middleware `tenantScope.js`:**
- Extrae `negocio_id` del JWT (incluido en token al login/signup)
- Inyecta `req.negocioId` y `req.isScoped` en el request
- **Tablas sin scope** (`UNSCOPED_TABLES`): `users`, `negocios`, `user_profiles`
- Todas las demás tablas: filtro obligatorio por `negocio_id`

### Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Todo: lavadas, clientes, reportes, pagos, configuración |
| `trabajador` | Lavadas, clientes, reportes (sin pagos ni admin) |
| `viewer` | Solo lectura: home, dashboard, configuración |
| `superadmin` | Panel `/admin` — solo email `principal@themonaco.com.co` |

El control de roles se hace en frontend via `RoleGuard.jsx` (deniega rutas desconocidas por defecto) y en backend via middleware `superadmin.js` para rutas admin.

### Planes y Límites

| Plan | Lavadas/mes | Clientes | IA | Pagos |
|------|------------|----------|-----|-------|
| **Free** | 50 | 30 max | No | No |
| **PRO** | Ilimitado | Ilimitado | Sí | Sí |

- Trial: 7 días PRO gratis al registrarse (sin tarjeta)
- Precios: $49.900 COP/mes o $490.000 COP/año
- Gestión: columnas `plan`, `trial_ends_at`, `subscription_expires_at` en tabla `negocios`
- Enforcement: middleware `planLimits.js` bloquea POST a `lavadas` y `clientes` si se exceden límites
- Feature gates: `PlanGuard.jsx` en frontend oculta features PRO

---

## 4. Base de Datos (PostgreSQL 16)

### Esquema Completo

**Tablas Core (3):**

```sql
users (id UUID PK, email UNIQUE, password_hash, created_at)
negocios (id UUID PK, nombre, setup_complete, plan, trial_ends_at, subscription_expires_at, subscription_period, created_at)
user_profiles (id UUID PK → users.id, negocio_id → negocios.id, nombre, rol, lavador_id, created_at)
```

**Tablas de Negocio (13):**

```sql
-- Catálogos (configuración del negocio)
tipos_membresia (id, nombre, precio, descuento, cashback, duracion_dias, activo, negocio_id)
tipos_lavado (id, nombre, precio, descripcion, adicionales_incluidos UUID[], activo, es_base, negocio_id)
lavadores (id, nombre, telefono, activo, tipo_pago, pago_porcentaje, pago_sueldo_base, pago_por_lavada, pago_por_adicional, pago_porcentaje_lavada, pago_adicional_fijo, pago_adicionales_detalle JSONB, negocio_id)
metodos_pago (id, nombre, activo, negocio_id)
servicios_adicionales (id, nombre, precio, activo, negocio_id)
categorias_transaccion (id, nombre, tipo ['INGRESO'|'EGRESO'], activo, negocio_id)
plantillas_mensaje (id, nombre, texto, activo, negocio_id)

-- Datos operacionales
clientes (id, nombre, cedula, telefono, correo, placa UNIQUE per negocio, moto, membresia_id, fecha_inicio/fin_membresia, estado, cashback_acumulado, negocio_id)
lavadas (id, placa, cliente_id, tipo_lavado_id, tipo_membresia_id, lavador_id, metodo_pago_id, valor, estado, fecha TIMESTAMPTZ, notas, adicionales JSONB, pagos JSONB, cera_restaurador, kit_completo, tiempos de tracking..., negocio_id)
transacciones (id, tipo, categoria, descripcion, valor, placa_o_persona, fecha DATE, metodo_pago_id, negocio_id)
productos (id, nombre, precio, cantidad, activo, negocio_id)
tareas (id, nombre, frecuencia, dias_semana INT[], activo, negocio_id)
tareas_completadas (id, tarea_id, fecha, lavador_id, completada, hora_completada, negocio_id)
pago_trabajadores (id, lavador_id, fecha, fecha_desde, fecha_hasta, lavadas_cantidad, kit/cera/adicionales_cantidad, basico, total, descuentos, descuentos_detalle JSONB, total_pagar, detalle JSONB, metodo_pago_id, anulado, abonos_detalle JSONB, negocio_id)
reservas (id, placa, telefono, nombre_cliente, fecha_hora TIMESTAMPTZ, estado, origen, notas, negocio_id)
mensajes_enviados (id, cliente_id, plantilla_id, plantilla_nombre, mensaje_texto, enviado_por, origen, negocio_id)
```

**Tablas de Sistema (3):**

```sql
audit_log (id, tabla, accion, registro_id, antes JSONB, despues JSONB, descripcion, usuario_email, negocio_id)
pagos_suscripcion (id, negocio_id, wompi_transaction_id UNIQUE, wompi_reference, monto, moneda, estado, periodo, datos_wompi JSONB, periodo_desde, periodo_hasta)
checkout_payments (id, customer_email, periodo, wompi_transaction_id UNIQUE, wompi_reference, monto, estado, datos_wompi JSONB, negocio_id, claimed_at)
```

### Estados de Lavada (Flujo de Trabajo)

```
EN ESPERA → EN LAVADO → TERMINADO → ENTREGADO
```

- `EN ESPERA`: moto esperando, no se ha lavado
- `EN LAVADO`: se está lavando activamente
- `TERMINADO`: lavado completado, moto no entregada
- `ENTREGADO`: moto entregada al cliente (proceso completo)

Cada transición registra timestamps (`tiempo_espera_inicio`, `tiempo_lavado_inicio`, `tiempo_terminado_inicio`) y duraciones en segundos (`duracion_espera`, `duracion_lavado`, `duracion_terminado`).

### Trap Crítico: Timezone de DATE en pg

```js
// server/src/config/database.js
pg.types.setTypeParser(1082, val => val)
```

**Problema:** El driver `pg` convierte columnas DATE a objetos JS Date en midnight UTC. En Docker (UTC), `DATE 2026-03-05` → `2026-03-05T00:00:00.000Z`. Al convertir a Bogotá (UTC-5), midnight UTC se convierte en **el día anterior** (4 de marzo, 7 PM). En localhost (timezone Colombia) no ocurre.

**Solución:** Retornar DATE como string `'YYYY-MM-DD'` sin conversión. El frontend usa `fechaToBogotaDate()` en `src/utils/date.js`.

### Indexes

```sql
-- Todos los negocio_id tienen index para filtrado de tenant
idx_clientes_placa, idx_lavadas_fecha, idx_lavadas_cliente, idx_lavadas_lavador
idx_transacciones_fecha, idx_reservas_fecha, idx_audit_log_created
idx_pagos_suscripcion_referencia, idx_checkout_payments_estado/reference
-- Unique constraint: placa por negocio
idx_clientes_placa_negocio ON clientes(placa, negocio_id)
```

---

## 5. Backend API (Express.js)

### Entry Point (`server/src/index.js`)

```
HTTP Server → Socket.io init
           → CORS + JSON parser (10mb limit)
           → Socket.io injector (req.io)
           → Routing:
               /api/health     → Health check (no auth)
               /api/auth/*     → Auth routes (no auth middleware)
               /api/rpc/*      → RPC routes (auth)
               /api/ai/*       → AI routes (auth, PRO check interno)
               /api/wompi/*    → Pagos (auth per-route, webhook público)
               /api/admin/*    → Admin (auth + superadmin)
               /api/:table     → CRUD genérico (auth + tenantScope + planLimits)
           → Error handler
           → Static files (producción: sirve dist/)
```

### Variables de Entorno (10 requeridas)

```bash
DATABASE_URL          # postgresql://user:pass@host:5432/db
JWT_SECRET            # HS256 secret para JWT
PORT                  # 3001 (default)
NODE_ENV              # development | production
CORS_ORIGIN           # https://themonaco.com.co
FRONTEND_URL          # https://themonaco.com.co
WOMPI_PUBLIC_KEY      # pub_prod_... o pub_test_...
WOMPI_PRIVATE_KEY     # prv_prod_... o prv_test_...
WOMPI_EVENTS_SECRET   # Secret para verificar webhooks
WOMPI_INTEGRITY_SECRET # Secret para hash de integridad
OPENAI_API_KEY        # sk-...
OPENAI_MODEL          # gpt-5.3-chat-latest (opcional, default)
```

### API CRUD Genérica (`/api/:table`)

Implementa un patrón REST estilo Supabase con query string filters:

```
GET    /api/lavadas?select=*,cliente:clientes(nombre)&estado=eq.TERMINADO&order=fecha.desc&limit=10
POST   /api/lavadas                    → INSERT (soporta arrays para bulk)
PATCH  /api/lavadas?id=eq.<uuid>       → UPDATE con filtros
DELETE /api/lavadas?id=eq.<uuid>       → DELETE con filtros
```

**Operadores de filtro:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, `or`

**Joins:** `select=*,cliente:clientes(nombre,placa)` → resuelve foreign keys con LEFT JOIN y re-fetch post-INSERT/UPDATE

**Realtime:** Cada INSERT/UPDATE/DELETE emite evento Socket.io `db:${table}` a la room `negocio:${negocioId}`

**Tablas permitidas:** Whitelist en `queryBuilder.js` via `isAllowedTable()`

### Rutas de Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/signup` | No | Crear usuario (email + password ≥6 chars) |
| POST | `/login` | No | Login → devuelve JWT session |
| POST | `/verify-password` | No | Verificar contraseña actual |
| PUT | `/update-email` | Sí | Cambiar email (requiere contraseña actual) |
| PUT | `/update-password` | Sí | Cambiar contraseña (requiere contraseña actual) |
| GET | `/session` | No | Validar token y devolver sesión |
| DELETE | `/account` | Sí (admin) | Eliminar cuenta + todo el negocio (CASCADE) |

**JWT payload:** `{ sub: userId, email, negocio_id }`

### Rutas RPC (`/api/rpc`)

| Ruta | Descripción |
|------|-------------|
| `register_negocio` | Crear negocio + perfil + datos semilla (signup) |
| `crear_negocio_y_perfil` | Crear negocio post-confirmación email |
| `complete_setup` | Marcar setup wizard como completado |

Cada RPC que crea un negocio:
1. Crea el registro en `negocios` con trial de 7 días
2. Crea `user_profiles` con rol `admin`
3. Ejecuta `seedNegocio()` (datos por defecto: métodos pago, tipos lavado, etc.)
4. Re-emite JWT con `negocio_id` en el token

### Rutas Wompi (`/api/wompi`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/config` | Sí | Public key + precios de planes |
| GET | `/pse-banks` | No | Instituciones financieras PSE |
| GET | `/status` | Sí | Estado actual del plan (free/trial/active/cancelled) |
| GET | `/check-transaction/:id` | Sí | Verificar estado de transacción |
| POST | `/create-payment-reference` | Sí | Generar referencia + hash integridad |
| POST | `/pay` | Sí | Pago con CARD/PSE/NEQUI (usuario autenticado) |
| POST | `/public-pay` | No | Checkout público (pagar antes de registrarse) |
| GET | `/public-check-transaction/:id` | No | Verificar checkout público |
| POST | `/claim-checkout` | Sí | Reclamar checkout aprobado (vincular a negocio) |
| POST | `/start-trial` | Sí | Iniciar trial de 7 días |
| POST | `/cancel` | Sí | Cancelar suscripción (mantiene PRO hasta expiración) |
| POST | `/webhook` | No | Webhook de Wompi (verifica firma SHA256) |

**Flujo de pago (CARD):**
1. Frontend llama `/create-payment-reference` → genera referencia + integrity hash
2. Frontend llama `/pay` con datos de tarjeta
3. Backend tokeniza tarjeta con Wompi (`/tokens/cards`)
4. Backend crea transacción con Wompi (`/transactions`)
5. Si PENDING, hace polling (hasta 10 intentos, 2s delay)
6. Si APPROVED: actualiza `negocios.subscription_expires_at`, registra en `pagos_suscripcion`
7. Webhook de Wompi como backup (verifica firma, activa si no fue activado por `/pay`)

**Flujo de pago (PSE):**
1. Mismos pasos 1-4 pero con datos PSE
2. Backend hace polling para obtener `async_payment_url` (URL del banco)
3. Frontend redirige al usuario al banco
4. Webhook de Wompi confirma resultado

**Verificación de firma webhook:**
```js
signString = `${tx.id}${tx.status}${tx.amount_in_cents}${tx.currency}${timestamp}${events_secret}`
expectedSig = SHA256(signString)
```

### Rutas AI (`/api/ai`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/chat` | Sí (PRO) | Chat con IA (texto, max 1000 chars) |
| POST | `/transcribe` | Sí (PRO) | Transcribir audio (Whisper-1, max 25MB) |

**Rate limit:** 30 mensajes/hora por negocio (in-memory Map)

---

## 6. Sistema de IA (IA Monaco)

### Arquitectura

```
Usuario → /api/ai/chat (texto) o /api/ai/transcribe (audio)
        → aiService.chat()
           → getBusinessContext() [cache 5min: servicios, lavadores, métodos]
           → getSystemPrompt() [inyecta contexto + reglas + fecha]
           → Loop OpenAI (max 10 rounds):
              → Envía mensajes a GPT-5.3
              → Si hay tool_calls → executeTool() → agrega resultado → continúa loop
              → Si no hay tool_calls → respuesta final al usuario
```

### Modelo y Configuración

- **Modelo:** `gpt-5.3-chat-latest` (configurable via `OPENAI_MODEL`)
- **Restricciones GPT-5:** No enviar `temperature` (causa error 400), usar `max_completion_tokens` en vez de `max_tokens`
- **Max tokens respuesta:** 2048
- **Sesiones:** TTL 30 minutos, ventana de conversación de 4 pares user/assistant
- **Tool calls y resultados se eliminan** entre mensajes para forzar queries frescas

### 12 Tools Disponibles

| Tool | Descripción | Parámetros clave |
|------|-------------|-----------------|
| `query_lavadas` | Buscar lavadas con filtros | fecha_desde/hasta, placa, lavador, estado |
| `query_clientes` | Buscar clientes | nombre, placa |
| `query_trabajadores` | Listar lavadores | nombre, solo_activos |
| `get_business_summary` | Resumen del día/semana/mes | periodo (hoy/semana/mes) |
| `ranking_lavadores` | Ranking de trabajadores | fecha_desde/hasta, orden (cantidad/ingresos) |
| `query_transacciones` | Buscar ingresos/egresos | fecha_desde/hasta, tipo, categoria |
| `resumen_financiero` | Balance completo | fecha_desde/hasta |
| `query_productos_servicios` | Catálogo de precios | (ninguno) |
| `crear_lavada` | Registrar nueva lavada | placa, tipo_lavado_nombre, lavador, adicionales |
| `analisis_metodos_pago` | Análisis de métodos de pago | fecha_desde/hasta |
| `query_tiempos` | Tiempos promedio de servicio | fecha_desde/hasta, lavador |
| `top_clientes` | Mejores clientes | fecha_desde/hasta, orden (visitas/gasto) |

### Patrón Anti-Alucinación

Cada tool retorna:
- `resumen_texto`: Texto pre-formateado con datos exactos
- `_instruccion`: `"USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS."`

El prompt del sistema refuerza: "Tu fuente de verdad es ÚNICAMENTE lo que devuelven las tools."

### Contexto de Negocio (Cache 5 min)

```js
getBusinessContext(negocioId) → Map<negocioId, { data, fetchedAt }>
// Retorna: "SERVICIOS: Sencillo ($15,000), Completo ($25,000)\nLAVADORES: Juan, Pedro\nMÉTODOS: Efectivo, Nequi"
```

Se inyecta en el system prompt en cada mensaje para que la IA conozca la configuración sin llamar tools.

### Timezone en Queries de IA

Para `lavadas.fecha` (TIMESTAMPTZ):
```sql
-- CORRECTO:
fecha >= (date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota')

-- INCORRECTO (no usar):
fecha::date = CURRENT_DATE  -- Falla por timezone
```

### Prompt del Sistema

Estructura del system prompt (`aiPrompt.js`):
1. **Identidad:** Asistente de lavadero de motos, coach de negocio
2. **Contexto del negocio:** Servicios, lavadores, métodos de pago (inyectado dinámicamente)
3. **Estados de lavada:** Reglas sobre qué significa "lavadas completadas" vs "total"
4. **"Pregunta antes de actuar":** Si el mensaje es ambiguo, preguntar primero
5. **Personalidad:** Cálida, motivacional, emoji, español LATAM neutro
6. **Regla absoluta:** Solo datos de tools, nunca inventar
7. **Formato:** Max 3-5 líneas, listas con emojis, números con separador de miles
8. **Análisis proactivo:** Detectar pendientes de cobro, caídas, clientes fantasma
9. **Expertise:** Tips de marketing, retención, precios, lavadores
10. **Routing:** Qué tool usar según la pregunta
11. **Reglas crear lavada:** Requiere placa + tipo, preguntar si falta info
12. **Limitaciones:** Lo que la IA NO puede hacer

### Whisper (Transcripción de Voz)

- Modelo: `whisper-1`
- Idioma: Español (`language: 'es'`)
- Prompt hint: "Lavadero de motos, lavadas, clientes, placa, sencillo, completo..."
- **Filtro de alucinaciones:** Lista de frases conocidas que Whisper genera con audio vacío/ruido
- Max file size: 25MB (Multer memory storage)

---

## 7. Frontend (React 19 + Vite)

### Flujo de Autenticación

```
App.jsx
├── No session → LandingPage / Login / Register
└── Session existe → TenantProvider
    ├── needsOnboarding → Onboarding (crear negocio)
    ├── needsSetup → SetupWizard (configurar servicios, lavadores, etc.)
    └── Todo listo → DataProvider → TourProvider → Routes
```

### Rutas

| Ruta | Componente | Acceso |
|------|-----------|--------|
| `/` | `LandingPage` | Público (sin sesión) |
| `/login` | `Login` | Público |
| `/registro` | `Register` | Público |
| `/home` | `Home` | admin, trabajador, viewer |
| `/dashboard` | `Reportes` | admin, trabajador, viewer |
| `/lavadas` | `Lavadas` | admin, trabajador |
| `/clientes` | `Clientes` | admin, trabajador |
| `/pagos` | `PagoTrabajadores` | admin (PRO) |
| `/cuenta` | `Configuracion` | admin, trabajador, viewer |
| `/admin` | `AdminDashboard` | superadmin |

### Componentes (28 archivos .jsx)

**Páginas principales:**
- `Home.jsx` — Dashboard con cola de lavadas en tiempo real, stats rápidos
- `Lavadas.jsx` — CRUD de lavadas con estados, filtros, tracking de tiempos
- `Clientes.jsx` — Gestión de clientes con membresías y contacto
- `Reportes.jsx` — Analytics con Recharts (ingresos/egresos, stats de lavadores, balance)
- `PagoTrabajadores.jsx` — Nómina de trabajadores (feature PRO)
- `Configuracion.jsx` — Settings: usuarios, servicios, lavadores, métodos de pago, tareas
- `LandingPage.jsx` — Página de marketing con features, testimonios, precios

**Context Providers:**
- `TenantContext.jsx` — Estado del tenant: `negocioId`, `userProfile`, `planStatus`, `setupComplete`
- `DataContext.jsx` — Fetching centralizado + listeners de realtime (Socket.io)
- `ThemeContext.jsx` — Dark mode toggle (localStorage)
- `MoneyVisibilityContext.jsx` — Ocultar/mostrar montos (blur)
- `Toast.jsx` — ToastProvider + `useToast()` hook (reemplaza `alert()`)
- `AppTour.jsx` — TourProvider para onboarding de primera vez

**Guards:**
- `RoleGuard.jsx` — Protección de rutas por rol (deniega desconocidas)
- `PlanGuard.jsx` — Feature gates para PRO

**Shared Components:**
- `Layout.jsx` — Sidebar + navbar + slot de contenido
- `ServiceCard.jsx` — Tarjeta reutilizable para servicios/lavadores/clientes
- `NuevoServicioSheet.jsx` — Modal para agregar entidades
- `AiChat.jsx` — Chat con IA (texto + voz)
- `CheckoutModal.jsx` — Modal de pago Wompi (tokenización de tarjeta)
- `WompiWidget.jsx` — Widget de pago para suscripciones
- `UpgradeModal.jsx` — Modal de upsell a PRO
- `Balance.jsx` — Componente de balance financiero
- `Membresias.jsx` — Gestión de membresías
- `Tareas.jsx` — Tareas diarias de mantenimiento
- `SetupWizard.jsx` — Wizard de configuración inicial
- `Onboarding.jsx` — Flujo de crear negocio
- `Login.jsx` / `Register.jsx` — Auth forms

### Adaptador API (`supabaseClient.js`)

Drop-in replacement para `@supabase/supabase-js`. Todos los componentes importan:

```js
import { supabase } from './supabaseClient'

// Uso idéntico a Supabase:
const { data, error } = await supabase
  .from('lavadas')
  .select('*, cliente:clientes(nombre)')
  .eq('estado', 'TERMINADO')
  .order('fecha', { ascending: false })
  .limit(10)
```

**Internamente:**
- `QueryBuilder` — Clase con chaining (`.select()`, `.eq()`, `.insert()`, `.update()`, `.delete()`, `.order()`, `.limit()`, `.single()`)
- Construye URL con query params y llama `apiFetch()`
- `apiFetch()` — Wrapper de `fetch()` que agrega `Authorization: Bearer <token>` y parsea JSON
- Auth module — `signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`
- Realtime — `RealtimeChannel` class que escucha Socket.io events (`db:lavadas`, etc.)
- RPC — Llama `POST /api/rpc/{functionName}`

### Realtime (Socket.io)

**Server (`realtimeService.js`):**
```js
// Auth: verifica JWT en handshake
io.use((socket, next) => {
  const payload = verifyToken(socket.handshake.auth.token)
  socket.user = { id, email, negocio_id }
})

// Cada socket se une a room `negocio:${negocioId}`
socket.join(`negocio:${negocioId}`)
```

**Emisión de eventos (en `crud.js`):**
```js
req.io.to(`negocio:${req.negocioId}`).emit(`db:${table}`, {
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  table,
  record,
})
```

**Cliente (`DataContext.jsx`):**
```js
supabase.channel('lavadas-changes')
  .on('postgres_changes', { event: '*', table: 'lavadas' }, callback)
  .subscribe()
// → Internamente escucha socket.on('db:lavadas', callback)
```

### PWA (Vite PWA)

```js
// vite.config.js
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Monaco PRO',
    short_name: 'Monaco',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0a0a0f',
    background_color: '#0a0a0f',
  },
  workbox: {
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    runtimeCaching: [{
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'monaco-api', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
    }]
  }
})
```

### Code Splitting

```js
// vite.config.js
rollupOptions: {
  output: {
    manualChunks: {
      vendor: ['react', 'react-dom', 'react-router-dom'],
      ui: ['lucide-react', 'react-datepicker', 'react-select'],
      charts: ['recharts']
    }
  }
}
```

### Producción: Drop de console.log

```js
esbuild: {
  drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
}
```

---

## 8. Middleware Pipeline

```
Request entrante
│
├─ CORS (origin: env.corsOrigin)
├─ JSON parser (limit: 10mb)
├─ Socket.io injector (req.io = io)
│
├─ /api/health → DB healthcheck (sin auth)
│
├─ /api/auth/* → authRoutes (sin middleware de auth)
│
├─ /api/rpc/* → auth → rpcRoutes
│
├─ /api/ai/* → auth → aiRoutes (PRO check interno + rate limit)
│
├─ /api/wompi/* → wompiRoutes (auth per-route, webhook público)
│
├─ /api/admin/* → auth → superadmin → adminRoutes
│
├─ /api/:table → auth → tenantScope → planLimits → crudRoutes
│
└─ errorHandler (JSON error response)
```

### Detalle de cada Middleware

**`auth.js`:**
```
Authorization: Bearer <JWT> → verifyToken() → req.user = { id, email, negocio_id }
```

**`tenantScope.js`:**
```
req.user.negocio_id → req.negocioId, req.isScoped
Excluye: users, negocios, user_profiles
```

**`planLimits.js`:**
```
Solo aplica a POST en lavadas y clientes
→ Consulta plan del negocio
→ Si no es PRO: verifica límites (50 lavadas/mes, 30 clientes)
→ Si excede: 403 { error: 'PLAN_LIMIT_REACHED' }
```

**`superadmin.js`:**
```
Verifica req.user.email === 'principal@themonaco.com.co'
```

**`errorHandler.js`:**
```
Captura errores no manejados → JSON { error: message }
```

---

## 9. Despliegue

### Arquitectura de Producción

```
Internet
    │
    ▼
nginx (443 SSL, Let's Encrypt)
    │
    ├── / → /var/www/monaco/dist/ (SPA static files)
    │       try_files $uri $uri/ /index.html
    │
    ├── /api/* → proxy_pass http://127.0.0.1:3001
    │
    └── /socket.io/* → proxy_pass http://127.0.0.1:3001
                       (WebSocket upgrade)
    │
    ▼
PM2 → node src/index.js (puerto 3001)
    │
    ▼
PostgreSQL 16 (localhost:5432, db: MonacoProDB)
```

### VPS Setup (`deploy/setup-vps.sh`)

Instala:
- PostgreSQL 16 (usuario: `monaco`, db: `MonacoProDB`)
- Node.js 20 (via NodeSource)
- PM2 (process manager global)
- nginx (reverse proxy)
- Certbot (Let's Encrypt SSL para `themonaco.com.co`)

### nginx Config (`deploy/nginx-monaco.conf`)

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name themonaco.com.co www.themonaco.com.co;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/themonaco.com.co/fullchain.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Gzip
    gzip on;

    # SPA routing
    root /var/www/monaco/dist;
    location / { try_files $uri $uri/ /index.html; }

    # API proxy
    location /api/ { proxy_pass http://127.0.0.1:3001; }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static cache (1 año)
    location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Deploy Frontend (`scripts/deploy-frontend.sh`)

```bash
npm run build                                    # Vite build → dist/
rsync -avz --delete dist/ root@187.77.15.68:/var/www/monaco/dist/
ssh root@187.77.15.68 "nginx -t && systemctl reload nginx"
```

### Deploy Backend (`scripts/deploy-backend.sh`)

```bash
rsync -avz --delete --exclude node_modules --exclude .env server/ root@187.77.15.68:/var/www/monaco/server/
ssh root@187.77.15.68 << 'EOF'
    cd /var/www/monaco/server
    # Verifica .env con 10 vars requeridas
    npm install --production
    npm run migrate
    pm2 reload monaco-api  # o pm2 start si es primera vez
EOF
```

### Docker (`Dockerfile` — multi-stage)

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
COPY . .
RUN npm ci && npm run build

# Stage 2: Production server
FROM node:20-alpine
RUN apk add python3 make g++  # Para compilar bcrypt
COPY server/package.json ./server/
RUN cd server && npm install --production
COPY server/src ./server/src
COPY --from=frontend-build /app/dist /app/dist

# Migrations con retry (max 5 intentos, 5s delay)
CMD ["sh", "-c", "until node src/db/migrate.js; do sleep 5; done && node src/index.js"]
```

### Docker Compose (`docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: MonacoPro
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: MonacoProDB
    volumes: [postgres_data:/var/lib/postgresql/data]

  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [db]
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
```

### Scripts npm

**Frontend (`package.json`):**
```
dev         → vite (dev server con proxy a localhost:3001)
dev:prod    → API_TARGET=https://themonaco.com.co vite (dev contra producción)
build       → vite build
deploy      → sh scripts/deploy-frontend.sh
deploy:api  → sh scripts/deploy-backend.sh
db:connect  → sh scripts/db-tunnel.sh (SSH tunnel a DB de producción)
```

**Backend (`server/package.json`):**
```
dev         → node --watch src/index.js
start       → node src/index.js
migrate     → node src/db/migrate.js
seed        → node src/db/seed.js
export      → node src/db/export-supabase.js
import      → node src/db/import-data.js
```

---

## 10. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React SPA)                       │
│                                                                  │
│  LandingPage ─► Login/Register ─► TenantProvider                │
│                                        │                         │
│                               ┌────────┴────────┐               │
│                               │  DataProvider    │               │
│                               │  (fetch + WS)    │               │
│                               └────────┬────────┘               │
│                                        │                         │
│  ┌──────┬──────┬───────┬──────┬───────┬──────┐                  │
│  │ Home │Lavad.│Client.│Repor.│Pagos  │Config│                  │
│  └──────┴──────┴───────┴──────┴───────┴──────┘                  │
│                        │                                         │
│         supabaseClient.js (Supabase adapter)                    │
│         ┌──────────────┼──────────────┐                         │
│         │ HTTP REST     │ Socket.io    │ localStorage            │
└─────────┼──────────────┼──────────────┼─────────────────────────┘
          │              │              │
          ▼              ▼              │
┌─────────────────────────────────────────────────────────────────┐
│                  NGINX (reverse proxy + SSL)                     │
│    /api/* → :3001    /socket.io/* → :3001 (WS)    /* → dist/   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS API (:3001)                        │
│                                                                  │
│  Middleware: CORS → JSON → Socket.io inject → Auth → Tenant     │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ /auth    │ │ /api/:t  │ │ /wompi   │ │ /ai      │           │
│  │ signup   │ │ CRUD     │ │ pay      │ │ chat     │           │
│  │ login    │ │ genérico │ │ webhook  │ │ transcr. │           │
│  └──────────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│                    │            │             │                   │
└────────────────────┼────────────┼─────────────┼─────────────────┘
                     │            │             │
          ┌──────────┘            │             │
          ▼                       ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL 16   │  │  Wompi API   │  │  OpenAI API  │
│  (multi-tenant)  │  │  (pagos COP) │  │  GPT-5.3     │
│  negocio_id FK   │  │  CARD/PSE/   │  │  Whisper-1   │
│  en toda tabla   │  │  NEQUI       │  │              │
└──────────────────┘  └──────────────┘  └──────────────┘
```

---

## 11. Convenciones y Decisiones Arquitectónicas

| Decisión | Razonamiento |
|----------|-------------|
| **Adaptador Supabase custom** | Evitar vendor lock-in, control total del backend |
| **CRUD genérico estilo Supabase** | Minimizar código de rutas, frontend usa misma API |
| **Multi-tenant con FK** | Simple, robusto, sin particiones — escala suficiente para el negocio |
| **JWT con negocio_id** | Evita lookup adicional en cada request |
| **Socket.io para realtime** | Actualizaciones de estado de lavadas sin polling |
| **DATE como string** | Evitar trap de timezone del driver pg |
| **IA con resumen_texto** | Prevenir alucinaciones — el modelo cita datos pre-formateados |
| **Cache de contexto de negocio** | Reducir queries — servicios/lavadores cambian poco |
| **Tool calls iterativos** | Max 10 rounds — la IA puede encadenar queries complejas |
| **Webhook + polling** | Doble verificación de pagos — el webhook es backup del polling |
| **Docker multi-stage** | Single image con frontend + backend + migrations |
| **PM2 en producción** | Process management con auto-restart y logs |
| **Planes por fecha** | `trial_ends_at` / `subscription_expires_at` — sin cron jobs |
| **SPA routing en nginx** | `try_files $uri $uri/ /index.html` — React Router funciona |

---

## 12. Archivos Clave (Referencia Rápida)

### Backend
| Archivo | Propósito |
|---------|----------|
| `server/src/index.js` | Entry point Express + Socket.io |
| `server/src/config/env.js` | Validación de variables de entorno |
| `server/src/config/database.js` | Pool pg + fix timezone DATE |
| `server/src/config/logger.js` | Logger estructurado para producción |
| `server/src/db/schema.sql` | Schema completo + indexes + migrations |
| `server/src/db/migrate.js` | Ejecuta schema.sql contra la DB |
| `server/src/db/seed.js` | Datos semilla para negocios nuevos |
| `server/src/middleware/auth.js` | JWT verification |
| `server/src/middleware/tenantScope.js` | Aislamiento de tenant |
| `server/src/middleware/planLimits.js` | Límites del plan free |
| `server/src/middleware/superadmin.js` | Verificación de superadmin |
| `server/src/middleware/errorHandler.js` | Error handler global |
| `server/src/routes/auth.js` | Signup, login, update email/password, delete account |
| `server/src/routes/crud.js` | API CRUD genérica |
| `server/src/routes/rpc.js` | Procedimientos: crear negocio, setup |
| `server/src/routes/wompi.js` | Pagos Wompi (CARD/PSE/NEQUI, webhook) |
| `server/src/routes/ai.js` | Chat IA + transcripción de voz |
| `server/src/routes/admin.js` | Panel superadmin |
| `server/src/services/authService.js` | Hash, compare, sign/verify JWT |
| `server/src/services/queryBuilder.js` | Construye SQL desde query params |
| `server/src/services/joinResolver.js` | Resuelve JOINs del select string |
| `server/src/services/aiService.js` | Loop de chat OpenAI + sesiones |
| `server/src/services/aiTools.js` | 12 tools + ejecutor + business context cache |
| `server/src/services/aiPrompt.js` | System prompt completo |
| `server/src/services/realtimeService.js` | Socket.io init + auth + rooms |

### Frontend
| Archivo | Propósito |
|---------|----------|
| `src/App.jsx` | Entry point + routing + auth flow |
| `src/supabaseClient.js` | Adaptador API (QueryBuilder + Auth + Realtime + RPC) |
| `src/config/constants.js` | API_URL, TOKEN_KEY, SESSION_KEY |
| `src/utils/date.js` | Timezone conversion (Bogotá) |
| `src/components/TenantContext.jsx` | Estado del tenant (negocio, perfil, plan) |
| `src/components/DataContext.jsx` | Fetching centralizado + realtime listeners |
| `src/components/Home.jsx` | Dashboard principal |
| `src/components/Lavadas.jsx` | CRUD lavadas + tracking de estados |
| `src/components/Clientes.jsx` | Gestión de clientes |
| `src/components/Reportes.jsx` | Charts y analytics |
| `src/components/PagoTrabajadores.jsx` | Nómina de trabajadores |
| `src/components/Configuracion.jsx` | Settings del negocio |
| `src/components/AiChat.jsx` | Chat con IA (texto + voz) |
| `src/components/LandingPage.jsx` | Página de marketing |
| `src/components/RoleGuard.jsx` | Protección de rutas por rol |
| `src/components/PlanGuard.jsx` | Feature gates (PRO) |
| `src/components/Toast.jsx` | Sistema de notificaciones toast |
| `src/components/Layout.jsx` | Sidebar + navbar |
| `src/components/CheckoutModal.jsx` | Modal de pago Wompi |
| `src/components/SetupWizard.jsx` | Wizard de configuración inicial |

### Infraestructura
| Archivo | Propósito |
|---------|----------|
| `Dockerfile` | Build multi-stage (frontend + backend) |
| `docker-compose.yml` | PostgreSQL + app para desarrollo/producción |
| `vite.config.js` | Vite + PWA + proxy + code splitting |
| `deploy/nginx-monaco.conf` | Reverse proxy + SSL + SPA routing |
| `deploy/setup-vps.sh` | Setup completo del VPS |
| `scripts/deploy-frontend.sh` | Build + rsync al VPS |
| `scripts/deploy-backend.sh` | Sync server + npm install + pm2 reload |
