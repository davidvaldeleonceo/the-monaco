# Plan: Desktop Polish — Overflow, Architecture & UX Parity

## Contexto

Después de un rediseño extenso de la experiencia mobile (filtros glass, NumberTicker, SwipeableCard, balance sheet, etc.), el desktop se quedó atrás. Un audit completo revela problemas de overflow de números, rutas bloqueadas, breakpoints desalineados y UX gaps entre mobile y desktop.

---

## Cambios Priorizados

### FASE 1 — Overflow & Sizing (CSS puro, sin riesgo)

**Archivo: `src/App.css`**

#### 1.1 Balance cards — números se salen de la tarjeta
Las tarjetas desktop son `flex: 1; width: 277px` con `font-size: 4rem`. Un balance de $99,999,999 se desborda.

- `.home-balance-amount` (línea 7724): agregar `min-width: 0; overflow: hidden`
- `.nt-root` (línea 7431): agregar `min-width: 0` para que flex children puedan shrinkear
- Desktop override `.home-balance-card` (línea 8443): agregar `overflow: hidden`

#### 1.2 Tab total inline — se superpone con tab pills
`.home-tab-total-inline` desktop (línea 8714) es `position: absolute; left: 50%` sin max-width.

- Agregar: `max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`

#### 1.3 Service card valor — sin protección de overflow
`.lavada-card-valor-mini` (línea 4739) tiene `white-space: nowrap` pero NO tiene `overflow: hidden`.

- Agregar: `overflow: hidden; text-overflow: ellipsis; max-width: 180px`
- Desktop grid (línea 8932): cambiar `1fr auto 1fr` → `minmax(0, 1fr) auto minmax(0, 1fr)`

#### 1.4 Dashboard KPIs — 6 columnas apretadas
`.dash-kpis` desktop (línea 9169): `repeat(6, 1fr)` sin minmax.

- Cambiar a `repeat(6, minmax(0, 1fr))`
- `.dash-kpi-value` (línea 9189): agregar `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`

#### 1.5 Balance detail panel amount
`.balance-detail-panel-amount` (línea 8484): 2rem sin constraints.

- Agregar: `min-width: 0; overflow: hidden`

---

### FASE 2 — Sidebar Breakpoint Fix

**Archivo: `src/components/layout/Layout.jsx`**

El sidebar colapsa a `<1280px` pero desktop empieza a `1180px`. Hay 100px gap donde el usuario está en "desktop mode" con sidebar colapsada.

- Línea 42: cambiar `window.innerWidth < 1280` → `window.innerWidth < 1180`
- Línea 51: cambiar `if (w < 1280)` → `if (w < 1180)`

Esto sincroniza sidebar con el breakpoint desktop real.

---

### FASE 3 — Modal drag handle en desktop

**Archivo: `src/App.css`**

Los modales (.modal-sheet) se centran correctamente en desktop (línea 9352-9360), pero el drag handle sigue visible con `cursor: grab`. Confunde al usuario desktop.

- Agregar en el bloque `@media (min-width: 1180px)`:
```css
.modal-sheet-handle { display: none; }
```

---

### FASE 4 — MobileRedirect: desbloquear /clientes y /pagos en desktop

**Archivo: `src/App.jsx`**

Actualmente `MobileRedirect` en líneas 76-77 redirige mobile → Home tabs. Pero en desktop, las rutas `/clientes` y `/pagos` cargan bien. El problema es al REVÉS: la lógica dice "si es mobile, redirige". En desktop funciona.

**VERIFICAR**: ¿Realmente falla en desktop? `MobileRedirect` retorna `children` si `!isMobile`. Entonces en desktop DEBERÍA funcionar. El issue real es que el sidebar en desktop lleva a /clientes que muestra la página completa (con tabla desktop), y /pagos muestra PagoTrabajadores con tabla desktop.

→ **Confirmar** si esto ya funciona antes de cambiar. Si funciona, no hay cambio necesario aquí.

---

### FASE 5 — Balance Detail Panel: agregar breakdown rows que faltan

**Archivo: `src/components/pages/Home.jsx`**

El balance detail panel desktop (líneas 2498-2617) tiene chart pero NO tiene las filas de desglose por método/categoría que sí tiene el balance sheet mobile (líneas 2384-2450).

- Copiar el bloque de `home-balance-sheet-metodo-row` del balance sheet mobile al balance detail panel desktop
- Reusar los mismos datos (`balancePorMetodo`, `balancePorCategoria`) que ya están calculados

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/App.css` | Overflow fixes (5 áreas), modal handle hide, grid minmax |
| `src/components/layout/Layout.jsx` | Sidebar breakpoint 1280→1180 |
| `src/components/pages/Home.jsx` | Balance panel breakdown rows |

## Verificación

1. **Overflow**: Poner balance en $99,999,999 → verificar que no se sale de las tarjetas
2. **Tab total**: Con un total largo, verificar que no tapa los tabs ni el botón +
3. **Sidebar**: En ventana de 1200px ancho, sidebar debe estar expandida (no colapsada)
4. **Modal**: Abrir NuevoServicio en desktop → no debe mostrar el drag handle
5. **Balance panel**: Click en tarjeta Balance → debe mostrar chart + breakdown por método/categoría
6. **KPIs**: Dashboard con 6 KPIs visibles, valores monetarios no se truncan en 1180px
