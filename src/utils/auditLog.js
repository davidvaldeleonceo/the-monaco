import { supabase } from '../supabaseClient'

/**
 * Log an action to the audit_log table.
 *
 * @param {Object} params
 * @param {string} params.tabla - Table affected (e.g. 'lavadas', 'clientes')
 * @param {string} params.accion - Action type: 'create', 'update', 'delete'
 * @param {string} params.registro_id - ID of the affected record
 * @param {Object} [params.antes] - Previous values (for updates/deletes)
 * @param {Object} [params.despues] - New values (for creates/updates)
 * @param {string} [params.descripcion] - Human-readable description
 * @param {string} params.usuario_email - Email of the user performing the action
 * @param {string} params.negocio_id - Business ID
 */
export async function logAudit({ tabla, accion, registro_id, antes, despues, descripcion, usuario_email, negocio_id }) {
  try {
    await supabase.from('audit_log').insert({
      tabla,
      accion,
      registro_id: String(registro_id),
      antes: antes || null,
      despues: despues || null,
      descripcion: descripcion || `${accion} en ${tabla}`,
      usuario_email,
      negocio_id,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Audit logging should never block the main operation
    console.warn('Audit log failed:', err)
  }
}
