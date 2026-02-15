/**
 * Join Resolver
 *
 * Parses Supabase-style select strings with embedded joins like:
 *   "*, cliente:clientes(nombre), lavador:lavadores(nombre)"
 *
 * Convention: alias maps to {alias}_id FK on the source table.
 *   e.g. "cliente:clientes(nombre)" → LEFT JOIN clientes ON clientes.id = <table>.cliente_id
 *
 * Special case: "negocio:negocios(id, nombre)" for user_profiles
 *
 * Returns: { columns, joins, aliases }
 *   columns: SQL column expressions (e.g. "lavadas.*", "json_build_object('nombre', t1.nombre) AS cliente")
 *   joins: SQL JOIN clauses
 *   aliases: map of alias → { table, fields, tableAlias }
 */

const JOIN_PATTERN = /(\w+):(\w+)\(([^)]+)\)/g

export function parseSelect(table, selectStr) {
  if (!selectStr || selectStr.trim() === '*') {
    return { columns: [`"${table}".*`], joins: [], aliases: {} }
  }

  const columns = []
  const joins = []
  const aliases = {}
  let joinIndex = 0

  // Remove join patterns first, collect non-join columns
  let remaining = selectStr.replace(JOIN_PATTERN, '').trim()
  // Clean up leftover commas
  remaining = remaining.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim()

  if (remaining) {
    const cols = remaining.split(',').map(c => c.trim()).filter(Boolean)
    for (const col of cols) {
      if (col === '*') {
        columns.push(`"${table}".*`)
      } else {
        columns.push(`"${table}"."${col}"`)
      }
    }
  }

  // Parse join patterns
  let match
  const re = new RegExp(JOIN_PATTERN.source, 'g')
  while ((match = re.exec(selectStr)) !== null) {
    const alias = match[1]          // e.g. "cliente"
    const joinTable = match[2]      // e.g. "clientes"
    const fields = match[3].split(',').map(f => f.trim())
    const tableAlias = `_j${joinIndex++}`

    // FK convention: alias_id on source table
    const fkColumn = `${alias}_id`

    joins.push(
      `LEFT JOIN "${joinTable}" "${tableAlias}" ON "${tableAlias}"."id" = "${table}"."${fkColumn}"`
    )

    // Build json_build_object for the joined fields
    const jsonParts = fields.map(f => `'${f}', "${tableAlias}"."${f}"`).join(', ')
    columns.push(`json_build_object(${jsonParts}) AS "${alias}"`)

    aliases[alias] = { table: joinTable, fields, tableAlias }
  }

  // If no base columns were specified (only joins), add table.*
  if (columns.every(c => c.startsWith('json_build_object'))) {
    columns.unshift(`"${table}".*`)
  }

  return { columns, joins, aliases }
}
