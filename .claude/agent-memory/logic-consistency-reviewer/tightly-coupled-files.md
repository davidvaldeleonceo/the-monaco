---
name: Tightly coupled file groups
description: Groups of files that must be updated together when business logic changes
type: project
---

## Currency/money formatting chain
- `server/src/config/currencies.js` + `src/config/currencies.js` — must stay in sync (backend has `getFormatter`, frontend has `MEMBERSHIP_DEFAULTS`)
- `src/utils/money.js` — central frontend formatter, all components should use this
- `src/components/context/TenantContext.jsx` — calls `setCurrency()` on profile load
- `src/components/context/MoneyVisibilityContext.jsx` — wraps `formatMoney` with show/hide toggle

## AI system (must always match app logic)
- `server/src/services/aiTools.js` — SQL queries + `resumen_texto` formatting
- `server/src/services/aiPrompt.js` — system prompt with format rules
- `server/src/services/aiService.js` — passes context/moneda to both

## Negocio data chain (must all include same fields)
- `server/src/routes/bootstrap.js` — `json_build_object` for negocio
- `server/src/services/authService.js` — `buildSession` `json_build_object`
- `src/components/context/TenantContext.jsx` — fallback `.select()` query string

**How to apply:** When adding a column to `negocios`, update ALL THREE json_build_object / select queries.
