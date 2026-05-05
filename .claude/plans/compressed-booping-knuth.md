# Plan: Fix Popup Reload on Estado Change — Flat Card List

## Context / Problema

Cuando el usuario cambia el estado de un servicio desde el popup expandido (botones de estado-flow), **el popup entero se "recarga"** (parpadea, pierde estado local). El usuario espera que solo cambie el badge de estado sin afectar el popup.

**Causa raiz:** Las cards se renderizan como hijos de `<EstadoDropZone>` (un wrapper por cada estado). Cuando cambia el estado de una lavada, la card se mueve de un `EstadoDropZone` padre a otro. React interpreta esto como unmount + remount porque el componente cambio de padre, aunque el `key={item.id}` sea el mismo. El unmount destruye todo el estado local del ServiceCard (localPagos, localNotas, popup expandido, etc.).

**Flujo del bug:**
1. Usuario expande card → popup abierto
2. Click en boton de estado (ej: "Lavado") → `handleEstadoChange` → `updateLavadaLocal`
3. `lavadas` cambia en DataContext → `recentServicios` se recomputa → `grouped` cambia
4. Card pasa de `EstadoDropZone["EN ESPERA"]` a `EstadoDropZone["EN LAVADO"]`
5. React desmonta ServiceCard del padre viejo, remonta en el nuevo → popup se destruye y recrea

## Solucion: Lista Plana de Cards

Cambiar la estructura de renderizado para que **TODAS las cards sean hijos directos del mismo `<div>`**, sin wrappers de estado. Los headers de estado se inyectan como elementos hermanos (siblings) entre las cards. Asi React reconcilia por `key` sin unmount.

### Estructura actual (problematica):
```
div.lavadas-cards
  └─ EstadoDropZone[key="EN ESPERA"]     ← padre 1
  │    ├─ header
  │    ├─ DraggableServiceCard[key=1]     ← se desmonta cuando cambia estado
  │    └─ DraggableServiceCard[key=2]
  └─ EstadoDropZone[key="EN LAVADO"]     ← padre 2
       ├─ header
       └─ DraggableServiceCard[key=3]     ← se remonta aqui
```

### Estructura nueva (plana):
```
div.lavadas-cards
  ├─ EstadoDropZone[key="zone-EN ESPERA"]    ← solo header + droppable, NO wrapper
  ├─ DraggableServiceCard[key=1]              ← hijo directo, key estable
  ├─ DraggableServiceCard[key=2]
  ├─ EstadoDropZone[key="zone-EN LAVADO"]
  ├─ DraggableServiceCard[key=3]              ← solo cambia posicion, NO unmount
  ├─ EstadoDropZone[key="zone-TERMINADO"]
  └─ EstadoDropZone[key="zone-ENTREGADO"]
```

Cuando card 1 cambia de "EN ESPERA" a "EN LAVADO", solo se reordena en la lista plana. React la mueve sin desmontar porque tiene el mismo padre (`div.lavadas-cards`) y el mismo `key`.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/shared/EstadoDropZone.jsx` | Refactor: de wrapper a header inline (sin children prop) |
| `src/components/pages/Home.jsx` (~2877-2962) | Refactor render: lista plana con `flatMap` |
| `src/App.css` | Ajustar `.estado-drop-zone` para ser header inline, agregar `.drop-zone-active` expand |

**Sin cambios:** `DraggableServiceCard.jsx`, `ServiceCard.jsx`, `useServiceHandlers.js`

## Implementacion Detallada

### 1. EstadoDropZone.jsx — Refactor a Header Inline

De wrapper con `children` a componente inline que renderiza solo el header del grupo:

```jsx
import { useDroppable } from '@dnd-kit/core'
import { ESTADO_LABELS } from '../../config/constants'

export default function EstadoDropZone({ estado, color, isDragging, count }) {
  const { isOver, setNodeRef } = useDroppable({ id: estado })

  // Ocultar grupos vacios cuando no se arrastra
  if (!isDragging && count === 0) return null

  return (
    <div
      ref={setNodeRef}
      className={`estado-drop-zone ${isOver ? 'drop-zone-over' : ''} ${isDragging ? 'drop-zone-active' : ''} ${count === 0 ? 'drop-zone-empty' : ''}`}
      style={{ '--drop-color': color }}
    >
      {count > 0 ? (
        <div className="estado-category-header">
          <span className="estado-category-title" style={{ color }}>
            {ESTADO_LABELS[estado] || estado}
          </span>
          <span className="estado-category-count" style={{ color }}>
            {count}
          </span>
          <div className="estado-category-line" style={{ background: color }} />
        </div>
      ) : (
        <div className="drop-zone-placeholder">
          Soltar en {ESTADO_LABELS[estado] || estado}
        </div>
      )}
    </div>
  )
}
```

Cambios clave:
- Ya no recibe `children` — no es wrapper
- Recibe `count` para mostrar header con conteo
- Mueve el header markup aqui (antes estaba inline en Home.jsx)
- Sigue usando `useDroppable` con `id: estado` — DnD funciona igual

### 2. Home.jsx — Render Plano con flatMap

Reemplazar el bloque de render (~lineas 2879-2962):

```jsx
{(() => {
  const estadoOrder = ['EN ESPERA', 'EN LAVADO', 'TERMINADO', 'ENTREGADO']
  const estadoGroupColors = { /* mismos colores */ }
  const grouped = {}
  recentServicios.forEach(item => {
    const est = item.estado || 'EN ESPERA'
    if (!grouped[est]) grouped[est] = []
    grouped[est].push(item)
  })
  const dragDisabled = anyCardExpanded || modoSeleccion

  return estadoOrder.flatMap(est => {
    const cards = grouped[est] || []
    return [
      <EstadoDropZone
        key={`zone-${est}`}
        estado={est}
        color={estadoGroupColors[est]}
        isDragging={!!activeDragId}
        count={cards.length}
      />,
      ...cards.map(item => (
        <DraggableServiceCard key={item.id} id={item.id} disabled={dragDisabled}>
          <ServiceCard ... /> {/* mismas props que ahora */}
        </DraggableServiceCard>
      ))
    ]
  })
})()}
```

Cambios clave:
- `estadoOrder.flatMap` en vez de `.map` con EstadoDropZone wrapper
- EstadoDropZone es un sibling, no un parent
- Todas las `DraggableServiceCard` son hijos directos de `div.lavadas-cards`
- Header se mueve a EstadoDropZone (ya no inline)

### 3. DndContext — Agregar closestCenter

Importar `closestCenter` de `@dnd-kit/core` (ya lo importamos parcialmente):

```jsx
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core'
```

Agregar al DndContext:
```jsx
<DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
```

Esto mejora la precision del drop: busca el droppable cuyo centro esta mas cerca del puntero, en vez de requerir interseccion de rects. Funciona mejor con los headers inline (que son elementos delgados).

### 4. CSS — Ajustar drop zone styles

```css
/* Ya no es wrapper, es header inline */
.estado-drop-zone {
  border-radius: 0.5rem;
  transition: background 0.2s, outline 0.2s, min-height 0.2s, padding 0.2s;
  min-height: 0;
}

/* Durante drag: expandir para ser target facil */
.drop-zone-active {
  padding: 0.5rem 0.25rem;
  border-radius: 0.75rem;
  outline: 2px dashed var(--drop-color, var(--border-color));
  outline-offset: 2px;
  background: color-mix(in oklch, var(--drop-color, var(--border-color)) 6%, transparent);
}

/* Hover durante drag */
.drop-zone-over {
  background: color-mix(in oklch, var(--drop-color, var(--border-color)) 14%, transparent);
}

/* Zona vacia (visible solo durante drag) */
.drop-zone-empty {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## Verificacion

1. `npm run dev` — compila sin errores
2. **Test principal:** Expandir card → click en estado "Lavado" → estado cambia, popup queda abierto sin recargar, estado-flow actualiza badge activo
3. **Drag-and-drop:** Arrastrar card de "Espera" a "Entregado" → cambia estado (con validaciones)
4. **DnD + closestCenter:** Soltar cerca del header de un estado → registra el drop zone correcto
5. **Mobile:** Touch-hold 200ms + drag funciona; tap normal expande card
6. **Grupos vacios durante drag:** Se muestran como targets dropeables
7. **Estado local preservado:** Expandir card, editar pagos, cambiar estado → pagos locales no se pierden
8. Build: `npx vite build` sin errores
