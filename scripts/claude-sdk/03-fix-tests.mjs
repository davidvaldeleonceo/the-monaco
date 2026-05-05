/**
 * 03 - Encontrar y corregir tests rotos
 *
 * Caso de uso: Un test falla y quieres que Claude lo diagnostique
 * y corrija automaticamente.
 *
 * Costo aproximado: ~$0.15
 *
 * Uso: node scripts/claude-sdk/03-fix-tests.mjs
 *       node scripts/claude-sdk/03-fix-tests.mjs "nombre del test"
 */

import { query } from "@anthropic-ai/claude-code";

const PROYECTO = "/Users/davidvaldeleon/the-monaco";
const testEspecifico = process.argv[2] || "";

async function fixTests() {
  const prompt = testEspecifico
    ? `Ejecuta el test "${testEspecifico}", diagnostica por que falla, y corrigelo.`
    : `Ejecuta todos los tests del proyecto. Si alguno falla:
1. Lee el error completo
2. Identifica la causa raiz
3. Corrige el codigo (no el test, a menos que el test este mal)
4. Vuelve a ejecutar para verificar que pasa

NO modifiques .env ni archivos de configuracion de deploy.
Responde en español.`;

  console.log("🧪 Ejecutando y corrigiendo tests...\n");

  let sessionId;

  for await (const message of query({
    prompt,
    options: {
      allowedTools: [
        "Read",
        "Edit(src/**)",
        "Edit(server/src/**)",
        "Glob",
        "Grep",
        "Bash(npm test*)",
        "Bash(npx jest*)",
        "Bash(node --test*)"
      ],
      maxTurns: 30,
      maxBudgetUsd: 0.50,  // Limite de seguridad
      cwd: PROYECTO,
      settingSources: ["project"],
      effort: "high"
    }
  })) {
    if (message.type === "system") {
      sessionId = message.session_id;
    }

    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    }

    if (message.type === "result") {
      console.log(`\n\n💰 Costo: $${message.total_cost_usd?.toFixed(4) || "N/A"}`);

      if (message.subtype === "error_max_turns") {
        console.log(`\n⚠️  Llego al limite de turnos. Para continuar:`);
        console.log(`    Session ID: ${sessionId}`);
        console.log(`    Puedes retomar con resume: "${sessionId}"`);
      }
    }
  }
}

fixTests().catch(console.error);
