/**
 * 02 - Revisar cambios antes de commit
 *
 * Caso de uso: Hiciste cambios y quieres un code review automatico
 * antes de hacer commit. Lee el git diff y analiza.
 *
 * Costo aproximado: ~$0.08
 *
 * Uso: node scripts/claude-sdk/02-revisar-pr.mjs
 */

import { query } from "@anthropic-ai/claude-code";

const PROYECTO = "/Users/davidvaldeleon/the-monaco";

async function revisarCambios() {
  console.log("📋 Revisando cambios pendientes...\n");

  for await (const message of query({
    prompt: `Revisa todos los cambios pendientes en git (staged y unstaged).

Ejecuta git diff y git diff --staged, luego analiza:

1. **Bugs potenciales** — logica incorrecta, edge cases no manejados
2. **Seguridad** — datos sensibles expuestos, inyecciones, auth bypass
3. **Consistencia** — si los cambios en frontend matchean el backend
4. **AI Tools** — si se cambio logica de negocio, verifica que aiTools.js y aiPrompt.js esten actualizados
5. **Mobile** — si se toco UI, verifica que sea responsive

Formato de respuesta:
✅ Lo que esta bien
⚠️ Advertencias (no bloquean pero mejorar)
❌ Problemas que DEBEN corregirse antes de commit

Responde en español.`,
    options: {
      allowedTools: ["Read", "Glob", "Grep", "Bash(git diff*)", "Bash(git status*)", "Bash(git log*)"],
      maxTurns: 20,
      cwd: PROYECTO,
      settingSources: ["project"],
      effort: "high"
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    }

    if (message.type === "result") {
      console.log(`\n\n💰 Costo: $${message.total_cost_usd?.toFixed(4) || "N/A"}`);
    }
  }
}

revisarCambios().catch(console.error);
