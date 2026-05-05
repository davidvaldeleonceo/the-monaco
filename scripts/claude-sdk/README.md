# Claude Code SDK — Tutorial para Monaco PRO

## Instalacion

```bash
npm install @anthropic-ai/claude-code
```

Ya esta instalado en el proyecto. El paquete se importa asi:

```javascript
import { query } from "@anthropic-ai/claude-code";
```

> **Requisito:** Tener `claude` CLI instalado globalmente (`npm install -g @anthropic-ai/claude-code`)
> y `ANTHROPIC_API_KEY` configurado en tu entorno.

---

## Concepto basico

El SDK expone UNA funcion principal: `query()`. Es un **async generator** que hace streaming de mensajes.

```javascript
import { query } from "@anthropic-ai/claude-code";

for await (const message of query({
  prompt: "Haz X cosa",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],  // herramientas permitidas
    maxTurns: 20,                             // limite de iteraciones
    cwd: "/ruta/al/proyecto"                  // directorio de trabajo
  }
})) {
  // message.type puede ser: "system", "assistant", "user", "result"
  if (message.type === "result") {
    console.log("Costo:", message.total_cost_usd);
    console.log("Resultado:", message.result);
  }
}
```

---

## Tipos de mensaje

| `message.type` | Que es |
|-----------------|--------|
| `system`        | Metadata de la sesion (session_id) |
| `assistant`     | Respuesta de Claude (texto, tool_use) |
| `user`          | Tool results o input del usuario |
| `result`        | Resultado final (success, error_max_turns, error_max_budget_usd) |

---

## Opciones importantes

| Opcion | Tipo | Que hace |
|--------|------|----------|
| `allowedTools` | `string[]` | Herramientas auto-aprobadas (sin pedir permiso) |
| `disallowedTools` | `string[]` | Herramientas bloqueadas |
| `permissionMode` | `string` | `"default"`, `"acceptEdits"`, `"plan"`, `"bypassPermissions"` |
| `maxTurns` | `number` | Limite de ciclos tool-use |
| `maxBudgetUsd` | `number` | Limite de gasto en dolares |
| `effort` | `string` | `"low"`, `"medium"`, `"high"`, `"max"` |
| `cwd` | `string` | Directorio de trabajo |
| `settingSources` | `string[]` | `["project"]` para cargar CLAUDE.md y agents |
| `systemPrompt` | `string` | Prompt de sistema personalizado |
| `resume` | `string` | Session ID para retomar conversacion |

---

## Permisos por patron

Puedes ser granular con regex en `allowedTools`:

```javascript
allowedTools: [
  "Read",                         // Leer cualquier archivo
  "Edit(src/**/*.jsx)",           // Solo editar React components
  "Bash(npm test*)",              // Solo npm test y variantes
  "Bash(node scripts/*)",         // Solo scripts del proyecto
]
```

---

## Como ejecutar los scripts

```bash
# Desde la raiz del proyecto
node scripts/claude-sdk/01-analizar-codigo.mjs

# Con variables de entorno
ANTHROPIC_API_KEY=sk-xxx node scripts/claude-sdk/01-analizar-codigo.mjs
```

---

## Scripts disponibles (en este directorio)

| # | Script | Que hace | Costo aprox |
|---|--------|----------|-------------|
| 01 | `01-analizar-codigo.mjs` | Analisis de seguridad read-only | ~$0.05 |
| 02 | `02-revisar-pr.mjs` | Review de cambios antes de commit | ~$0.08 |
| 03 | `03-fix-tests.mjs` | Encuentra y corrige tests rotos | ~$0.15 |
| 04 | `04-coordinador.mjs` | Coordinador autonomo multi-tarea | ~$0.30 |
| 05 | `05-generar-reporte.mjs` | Genera reporte de estado del proyecto | ~$0.10 |
