# Plan: Abonos a Trabajadores (Pagos Parciales Diarios)

## Contexto

El dueño del negocio le da plata a los trabajadores durante el día (abonos) antes de hacer el pago formal al final del periodo. Ejemplo: el trabajador ganó 90K, le dieron 30K por Nequi al mediodía y 20K en efectivo a las 3pm → al final solo le quedan 40K por pagar. Actualmente no hay forma de registrar estos abonos parciales ni saber por qué método se dieron.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `server/src/db/schema.sql` | Nueva tabla `abonos_trabajadores` + indexes |
| `server/src/services/queryBuilder.js` | Agregar tabla al allowlist |
| `src/components/PagoTrabajadores.jsx` | UI completa: sheet de abono, botón abonar en cards, abonos en detalle, integración con pago formal |
| `src/App.css` | Estilos nuevos para abonos |

## Paso 1: Schema — Nueva tabla `abonos_trabajadores`

```sql
CREATE TABLE IF NOT EXISTS abonos_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lavador_id UUID NOT NULL REFERENCES lavadores(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL,
  nota TEXT,
  fecha DATE DEFAULT CURRENT_DATE,
  pago_trabajador_id UUID REFERENCES pago_trabajadores(id) ON DELETE SET NULL,
  anulado BOOLEAN DEFAULT false,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- `pago_trabajador_id` empieza NULL → se llena cuando se crea el pago formal del periodo
- Indexes en `negocio_id`, `lavador_id`, `fecha`

## Paso 2: Backend — Allowlist en queryBuilder.js

Agregar `'abonos_trabajadores'` al Set `ALLOWED_TABLES` (línea ~20). El CRUD genérico se encarga del resto.

## Paso 3: UI — Botón "Abonar" en cada tarjeta de trabajador

En cada `historial-worker-card`, agregar un botón "Abonar" que abre un sheet rápido:
- Monto (input numérico)
- Método de pago (select: Efectivo, Nequi, Daviplata, etc.)
- Nota opcional
- Botón guardar

## Paso 4: UI — handleAbonoSubmit

Al guardar un abono:
1. INSERT en `abonos_trabajadores` (lavador_id, valor, metodo_pago_id, nota, fecha, negocio_id)
2. INSERT en `transacciones` (tipo: 'EGRESO', categoria: 'ABONO TRABAJADOR', valor, metodo_pago_id, placa_o_persona: nombre trabajador)
3. Toast de confirmación + refresh data

## Paso 5: UI — Mostrar abonos en las tarjetas

- En `workerCards` useMemo: sumar abonos del periodo al `total_pagado` de cada trabajador
- En la tarjeta: mostrar línea "Abonos: $50.000 (2)" si hay abonos
- El saldo y "por pagar" reflejan los abonos

## Paso 6: UI — Abonos en el modal de detalle del trabajador

Al abrir detalle de un trabajador, mostrar sección "Abonos" con lista:
- Fecha | Método de pago | Nota | Valor
- Opción de anular cada abono (soft delete + eliminar transacción)

## Paso 7: UI — Integración con pago formal

Al crear un pago formal (handleSubmit):
1. Buscar abonos sin vincular (`pago_trabajador_id IS NULL`) para ese trabajador en el rango de fechas
2. Mostrar en el formulario: "Abonos ya entregados: -$50.000"
3. Auto-calcular `valor_pagado` = total_pagar - total_abonos
4. Después del INSERT exitoso del pago, vincular los abonos (`UPDATE SET pago_trabajador_id = nuevo_pago_id`)
5. La transacción del pago formal solo registra el monto restante

## Paso 8: CSS

- `.btn-abonar` — botón azul outline en cada tarjeta
- `.abono-item` — fila de abono en el detalle (fecha, método, nota, valor)
- `.historial-worker-abonos` — resumen de abonos en la tarjeta
- `.pago-linea-abonos` — línea de abonos en el form de pago formal

## Verificación

1. Abrir Trabajadores → click "Abonar" en una tarjeta → llenar monto + método → guardar
2. Verificar que aparece en Movimientos como EGRESO / ABONO TRABAJADOR con el método correcto
3. Verificar que la tarjeta del trabajador muestra "Abonos: $X" y el saldo se reduce
4. Crear pago formal → verificar que muestra "Abonos ya entregados" y el resta por pagar es correcto
5. En detalle del trabajador, verificar lista de abonos con método de pago
6. Anular un abono → verificar que se elimina la transacción y el saldo se actualiza
