# Plan: Reemplazar Recharts BarChart con componente custom CSS/Flexbox

## Context
Las gráficas de barras del balance en Home.jsx usan Recharts BarChart, que comprime barras y superpone labels cuando hay muchas categorías. El usuario quiere un componente custom con barras anchas (5rem), gap de 1rem, scroll horizontal tipo carrusel, fondo gris claro, y emojis estilo Apple en cada barra.

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/components/shared/BalanceBarChart.jsx` | **CREAR** — nuevo componente |
| `src/App.css` | Agregar clases `.bbc-*` |
| `src/components/pages/Home.jsx` | Reemplazar 2 bloques IIFE de Recharts, eliminar import recharts |

## Paso 1: Crear `BalanceBarChart.jsx`

**Props:**
- `chartData` — `[{ nombre, valor, negativo }]`
- `barColor` — `var(--accent-green|red|blue)`
- `selectedBarIndex` / `onBarClick` — interactividad click
- `chartHeight` — 250 (mobile) / 280 (desktop)
- `view` — `'metodo'` | `'categoria'` — para lookup de emoji

**Estructura:**
```
.bbc-scroll-wrapper (overflow-x: auto)
  .bbc-container (flex, align-items: flex-end, gap: 1rem)
    .bbc-column (width: 5rem, flex-shrink: 0) × N
      span.bbc-label  →  "$9.396.000" (formatMoney, NO abreviado)
      .bbc-track (flex: 1, bg: #E5E7EB, border-radius: 16px 16px 8px 8px)
        .bbc-fill (height: %, color dinámico, min-height: 8px)
          span.bbc-pct  →  "45.2%" (solo si seleccionado)
      img.bbc-emoji  →  Twemoji SVG 24×24
      span.bbc-name  →  "SERVICIO"
```

**Altura de barra:** `Math.max((valor / maxValor) * 100, 5)%` — mínimo 5% para $0.

**Colores:**
- Track (fondo): `#E5E7EB` (gris claro)
- Fill: `barColor` prop (verde/rojo/azul según pill), rojo si `negativo`
- Click: dims otros a 0.4 opacity, brightens seleccionado

## Paso 2: Emojis con Twemoji CDN (sin npm install)

Helper `twemojiUrl(emoji)` → `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/{codepoints}.svg`

**Mapa de emojis:**

| Nombre | Emoji | Hex |
|--------|-------|-----|
| servicio | 🫧 | 1fae7 |
| membresia | 👑 | 1f451 |
| otro | ❓ | 2753 |
| insumos | 🧴 | 1f9f4 |
| arriendo | 🏠 | 1f3e0 |
| pago trabajador | 👷 | 1f477 |
| abono a sueldo | 💰 | 1f4b0 |
| servicios publicos | ⚡ | 26a1 |
| efectivo | 💵 | 1f4b5 |
| nequi | 📱 | 1f4f1 |
| tarjeta | 💳 | 1f4b3 |
| transferencia | 🏦 | 1f3e6 |
| daviplata | 📲 | 1f4f2 |
| default | 📊 | 1f4ca |

Fallback: `<img>` con `onError` muestra emoji nativo Unicode.

## Paso 3: CSS (`.bbc-*` en App.css)

- `.bbc-scroll-wrapper` — `overflow-x: auto`, scrollbar sutil (4px)
- `.bbc-container` — `display: flex; align-items: flex-end; gap: 1rem; min-width: min-content`
- `.bbc-column` — `width: 5rem; flex-shrink: 0; cursor: pointer`
- `.bbc-track` — `flex: 1; background: #E5E7EB; border-radius: 16px 16px 8px 8px`
- `.bbc-fill` — `transition: opacity 0.3s, filter 0.3s, height 0.4s; border-radius: 16px 16px 0 0; min-height: 8px`
- `.bbc-label` — `font-size: 0.7rem; font-weight: 600; white-space: nowrap`
- `.bbc-name` — `font-size: 0.65rem; word-wrap: break-word; max-width: 5rem`
- `.bbc-pct` — `color: #fff; font-weight: 700; text-shadow`
- `.bbc-emoji` — `24px × 24px`

## Paso 4: Integración en Home.jsx

**Mobile (líneas ~2326-2394):** Reemplazar IIFE completo por:
```jsx
<BalanceBarChart chartData={chartData} barColor={barColor}
  selectedBarIndex={selectedBarIndex}
  onBarClick={(i) => setSelectedBarIndex(selectedBarIndex === i ? null : i)}
  chartHeight={250} view={balanceSheetView} />
```

**Desktop (líneas ~2490-2558):** Igual pero `chartHeight={280}`.

La lógica de `chartData`/`barColor` se mantiene en el IIFE — solo se reemplaza el JSX de Recharts por `<BalanceBarChart />`.

## Paso 5: Limpiar imports

Eliminar línea 13 completa:
```
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, LabelList } from 'recharts'
```
Ninguno de estos componentes se usa en otro lugar de Home.jsx (AreaChart/Area/CartesianGrid/Tooltip nunca se usaron).

## Verificación
1. `npx vite build` sin errores
2. Vista mobile: barras anchas, scroll horizontal, emojis visibles
3. Vista desktop: igual pero más alto
4. Click en barra → muestra %, dims otras
5. Toggle pills (balance/ingresos/egresos) → colores cambian
6. Toggle vista (métodos/categorías) → emojis y datos cambian
7. Categoría con $0 → barra mínima visible (si se quita el filter)
