# Plan: Fix tour en mobile — incluir tab Trabajadores

## Problema
El bottom bar de mobile tiene: Home, Análisis, Clientes, **Trabajadores** (`/pagos`), Cuenta.
**No tiene `/balance`** — eso solo está en el sidebar de desktop.

El tour actual (pasos 9–10):
- Paso 9 (`nav-balance`): busca `.floating-bottom-bar a[href="/balance"]` → **no existe en mobile** → se salta con timeout 2s
- Paso 10 (`nav-cuenta`): navega a `/balance`, encuentra `/cuenta` en bottom bar → funciona

Resultado: de Clientes salta directo a Configuración, omitiendo Trabajadores.

## Solución
Reemplazar los últimos 2 pasos por 3, para que el tour pase por Trabajadores antes de llegar a Configuración.

### Cambios en `src/config/tourSteps.js`

Reemplazar pasos 9–10 por:

| # | Página | Selector | Título | Descripción | Position |
|---|--------|----------|--------|-------------|----------|
| 9 | /clientes | `.sidebar-nav a[href="/balance"], .floating-bottom-bar a[href="/pagos"]` | Balance y Trabajadores | Controla ingresos/egresos y gestiona pagos a tu equipo. | top |
| 10 | /pagos | `.pagos-page .clientes-search-row` | Pago de trabajadores | Busca, filtra y registra pagos a tus trabajadores. | bottom |
| 11 | /pagos | `.sidebar-nav a[href="/cuenta"], .floating-bottom-bar a[href="/cuenta"]` | Configuración | Configura servicios, pagos, trabajadores. Repite este tutorial. | top |

**Mobile**: Paso 9 resalta "Trabajadores" en bottom bar → Paso 10 muestra la página de pagos → Paso 11 resalta "Cuenta"
**Desktop**: Paso 9 resalta "Balance" en sidebar → Paso 10 navega a `/pagos` y muestra barra de búsqueda → Paso 11 resalta "Mi Cuenta"

### Por qué funciona en ambos
- Paso 9: selector con coma — en desktop, `.sidebar-nav a[href="/balance"]` es visible (sidebar display:flex). En mobile, `.floating-bottom-bar a[href="/pagos"]` es visible.
- Paso 10: `.pagos-page .clientes-search-row` existe en ambos (PagoTrabajadores siempre renderiza esa fila).
- Paso 11: `/cuenta` existe en sidebar y en bottom bar.

### Archivo a modificar
Solo `src/config/tourSteps.js` — reemplazar los últimos 2 objetos del array por 3 nuevos.
