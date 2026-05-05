export function getDescuentoMembresia(cliente, tiposMembresia) {
  if (!cliente?.membresia_id) return 0
  const mem = tiposMembresia?.find(m => m.id === cliente.membresia_id)
  if (!mem || !mem.descuento || mem.descuento <= 0) return 0
  if (cliente.fecha_fin_membresia) {
    const finStr = typeof cliente.fecha_fin_membresia === 'string'
      ? cliente.fecha_fin_membresia.split('T')[0]
      : null
    const fin = finStr ? new Date(finStr + 'T00:00:00') : new Date(cliente.fecha_fin_membresia)
    if (isNaN(fin.getTime())) return 0
    fin.setHours(0, 0, 0, 0)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (fin < hoy) return 0
  }
  return Number(mem.descuento)
}

export function aplicarDescuento(subtotal, descuentoDecimal) {
  if (!descuentoDecimal || descuentoDecimal <= 0) return subtotal
  const descuento = Math.round(subtotal * descuentoDecimal)
  return Math.max(0, subtotal - descuento)
}
