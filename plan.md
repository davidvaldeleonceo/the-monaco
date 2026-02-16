# Plan: Dark Mode — Ajustar paleta hacia charcoal/slate moderno

## Analisis — Referencia vs Actual

### Referencia (screenshot)
- **Fondo**: Charcoal muy oscuro con leve tinte azul-purpura (~`#1C1C2E`)
- **Cards**: Ligeramente mas claras que el fondo (~`#252540`), bordes sutiles visibles
- **Sidebar**: Tono similar al fondo, se integra sin linea dura
- **Nav activo**: Pill/chip redondeado con fondo purpura/indigo sutil
- **Texto**: Blanco puro para numeros/titulos, gris claro para labels
- **Acentos**: Azul/indigo dominante en graficos, verde/rojo/amarillo para estados
- **Sensacion**: Charcoal espacioso, neutro, menos saturado

### Actual (Monaco dark mode)
- **Fondo**: Navy blue fuerte `#0B1F3B`
- **Cards**: Navy mas claro `#133253`, borde `#1E3A5F`
- **Sidebar**: `#0F2847` con borde derecho visible `#1E3A5F`
- **Nav activo**: Borde derecho verde `#62B6CB` + fondo tinted
- **Texto**: Blanco `#fff`, secundario `#8BA7BF` (tono azulado)
- **Acentos**: Teal/cyan `#62B6CB` como primario
- **Sensacion**: Navy blue naval, saturado

### Diferencias clave
1. **Hue**: Navy saturado vs charcoal neutro — la ref es mas "universal dark" menos "marina"
2. **Contraste card/fondo**: La ref tiene mas separacion visual entre cards y fondo
3. **Nav activo**: Pill redondeado vs borde lateral — ref es mas moderno
4. **Texto secundario**: La ref es gris neutro, el actual es azulado
5. **Accent primario**: La ref usa purpura/indigo, el actual usa teal

---

## Cambios propuestos — Solo `src/App.css`

### 1. Nueva paleta `:root` (dark mode)

```css
:root {
  --bg-primary: #13131A;      /* Fondo principal — charcoal profundo */
  --bg-secondary: #1A1A25;    /* Sidebar, fondos secundarios */
  --bg-card: #21212E;         /* Cards — separacion visible del fondo */
  --bg-hover: #2A2A3A;        /* Hover states */
  --text-primary: #F1F1F4;    /* Texto principal — blanco suave, no puro */
  --text-secondary: #8B8B9E;  /* Labels — gris neutro, no azulado */
  --accent-green: #62B6CB;    /* Mantener teal (ya es identidad de la app) */
  --accent-blue: #3b82f6;     /* Sin cambio */
  --accent-yellow: #f59e0b;   /* Sin cambio */
  --accent-red: #ef4444;      /* Sin cambio */
  --accent-purple: #8b5cf6;   /* Sin cambio */
  --border-color: #2A2A3A;    /* Bordes — sutil pero visible */
  --overlay-dark: rgba(0, 0, 0, 0.7);
  --shadow-green: rgba(98, 182, 203, 0.12);
  --shadow-red: rgba(239, 68, 68, 0.12);
  --shadow-blue: rgba(59, 130, 246, 0.12);
  --card-shadow: none;
}
```

**Razonamiento**: Se mantiene `--accent-green: #62B6CB` porque es la identidad visual de Monaco PRO (botones, nav activo, etc). Solo cambia el "lienzo" de navy a charcoal.

### 2. Nav activo — pill redondeado (opcional, alta impacto visual)

Cambiar `.nav-item.active` de borde derecho a pill con fondo:

```css
/* Antes */
.nav-item.active {
  background: rgba(98, 182, 203, 0.1);
  color: var(--accent-green);
  border-right: 3px solid var(--accent-green);
}

/* Despues */
.nav-item.active {
  background: rgba(98, 182, 203, 0.12);
  color: var(--accent-green);
  border-right: none;
  border-radius: 10px;
  margin: 0 0.75rem;
  padding: 0.875rem 0.75rem;  /* Ajustar padding por el margin */
}
```

### 3. Sidebar — sin borde, fondo ligeramente diferente

La referencia muestra sidebar integrado sin linea divisoria:

```css
.sidebar {
  /* Cambiar border-right de solid a none */
  border-right: 1px solid transparent;  /* o quitar del todo */
}
```

En dark mode el sidebar ya es `--bg-secondary` que sera `#1A1A25` vs `--bg-primary` `#13131A` — la diferencia sutil es suficiente sin borde.

### 4. Card shadow en dark mode (opcional)

La referencia muestra cards con ligera profundidad. Opcion:
```css
--card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
```
Pero esto es sutil. Podemos mantener `none` y confiar en el contraste de color.

---

## Lo que NO cambia
- Light mode (ya implementado)
- Estructura de componentes JSX
- Accent colors (green, blue, red, yellow, purple)
- Border-radius, tipografia, spacing
- Logica de theme switching

## Riesgo
- **Bajo**: Solo cambia variables CSS, es facilmente reversible
- El teal `#62B6CB` sobre charcoal puede verse ligeramente diferente que sobre navy — verificar contraste

## Verificacion
- Dark mode: Fondo charcoal neutro, cards con separacion visual clara
- Sidebar: Se integra sin linea dura
- Nav activo: Pill redondeado (si se aprueba)
- Light mode: Sin cambios
- Texto legible en todos los contextos
