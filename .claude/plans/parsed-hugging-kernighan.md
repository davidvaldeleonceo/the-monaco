# Plan: Pulir Fullscreen Search — CSS + Iconos por categoria

## Contexto

La pantalla de busqueda fullscreen (`showFullSearch` en Home.jsx) ya funciona pero el CSS es basico y no tiene iconos por categoria. El usuario quiere:
1. CSS acorde al resto de la app (transiciones de entrada/salida, estilos consistentes con MobileSettings)
2. Cada resultado con un icono segun su tipo (como en Configuraciones): user para clientes, droplets para servicios, etc.
3. Transiciones suaves de entrada y salida

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.css` | Reescribir `.fullsearch-*` con animaciones, iconos, dark mode |
| `src/components/pages/Home.jsx` | Agregar iconos por tipo, animacion de cierre |

## Paso 1: CSS — Animacion de entrada y salida

Reutilizar los keyframes existentes de la app:
- **Entrada:** `pago-popover-in` (0.3s ease-out) — ya existe, usa `translateY(30px)` → `translateY(0)`
- **Salida:** `msettings-out` (0.25s ease-in forwards) — ya existe, inverso

Agregar clase `.fullsearch-closing` para la salida animada.

```css
.fullsearch-overlay {
  /* ...existente... */
  animation: pago-popover-in 0.3s ease-out;
}
.fullsearch-overlay.fullsearch-closing {
  animation: msettings-out 0.25s ease-in forwards;
}
```

## Paso 2: CSS — Redisenar items estilo MobileSettings

Cambiar `.fullsearch-item` de layout vertical (column) a horizontal (row) con icono:

```
[ ICONO ]  Label principal
           Subtitulo/detalle
```

Patron a seguir (de `.msettings-item`):
- `display: flex; align-items: center; gap: 0.875rem`
- `padding: 0.75rem 1rem`
- `border-radius: 12px`
- `transition: background 0.15s`

### Icono circular por tipo

Agregar `.fullsearch-type-icon` — circulo 40px (mas pequeno que msettings 56px para mayor densidad):
- `width: 40px; height: 40px; border-radius: 50%`
- `display: flex; align-items: center; justify-content: center`
- `flex-shrink: 0`
- Fondo sutil: `background: oklch(0.97 0.02 259)` (light), `background: rgba(255,255,255,0.06)` (dark)

Colores por tipo (reutilizando los de msettings):
- **servicios:** `color: oklch(0.55 0.22 260)` (azul, icon: `Droplets`)
- **productos:** `color: oklch(0.58 0.16 75)` (dorado, icon: `ShoppingBag`)
- **movimientos:** `color: oklch(0.55 0.14 220)` (cyan, icon: `ArrowLeftRight`)
- **clientes:** `color: oklch(0.6 0.22 170)` (teal, icon: `User`)
- **trabajadores:** `color: oklch(0.5 0.16 290)` (purple, icon: `Users`)

## Paso 3: CSS — Header mejorado

El header debe tener mas presencia:
- Padding mas generoso: `padding: 0.875rem 1rem`
- safe-area-top para notch: `padding-top: max(0.875rem, env(safe-area-inset-top))`
- Input mas grande: `font-size: 1.05rem`
- Border-bottom mas sutil

## Paso 4: CSS — Grupo titles

`.fullsearch-group-title` — estilo consistente con secciones de MobileSettings:
- `font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em`
- `color: var(--text-secondary)`
- `padding: 1rem 1.25rem 0.375rem` (mas separacion entre grupos)

## Paso 5: CSS — Dark mode

Agregar variantes `[data-theme="dark"]` para:
- `.fullsearch-overlay` background
- `.fullsearch-header` background
- `.fullsearch-type-icon` background
- `.fullsearch-input` color

## Paso 6: JSX — Agregar iconos por tipo en Home.jsx

Mapeo de tipo → icono (todos ya importados en Home.jsx):
```js
const searchTypeIcons = {
  servicios: Droplets,
  productos: ShoppingBag,
  movimientos: ArrowLeftRight,
  clientes: User,
  trabajadores: Users,
}
```

Cambiar cada `.fullsearch-item` de:
```jsx
<button className="fullsearch-item">
  <div className="fullsearch-item-label">...</div>
  <div className="fullsearch-item-sub">...</div>
</button>
```
A:
```jsx
<button className="fullsearch-item">
  <div className={`fullsearch-type-icon fullsearch-icon--${type}`}>
    <TypeIcon size={20} />
  </div>
  <div className="fullsearch-item-text">
    <div className="fullsearch-item-label">...</div>
    <div className="fullsearch-item-sub">...</div>
  </div>
</button>
```

## Paso 7: JSX — Animacion de cierre

Agregar estado `fullSearchClosing` para la animacion de salida:
```js
const closeFullSearch = () => {
  setFullSearchClosing(true)
  setTimeout(() => {
    setShowFullSearch(false)
    setFullSearchClosing(false)
  }, 250)
}
```

Usar `closeFullSearch()` en vez de `setShowFullSearch(false)` en:
- Boton back
- Al seleccionar un resultado

## Paso 8: CSS — Empty state mejorado

`.fullsearch-empty`:
- Icono de lupa grande y sutil arriba del texto
- `color: var(--text-secondary)`
- `padding: 4rem 2rem`

## Verificacion

1. Tap lupa en pill → pantalla se desliza desde abajo suavemente (0.3s)
2. Escribir "Juan" → resultados con iconos por tipo (gota azul = servicio, user teal = cliente, etc.)
3. Tap un resultado → cierre animado (0.25s), navega al tab correcto filtrado
4. Tap back arrow → cierre animado
5. Dark mode: fondos, iconos, texto consistentes
6. Build sin errores
