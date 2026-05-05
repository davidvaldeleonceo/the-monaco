/**
 * 04 - Coordinador autonomo de proyecto
 *
 * Caso de uso: Le das una tarea compleja y el la ejecuta de principio
 * a fin — lee, edita, testea y reporta. Es el "project manager" autonomo.
 *
 * Costo aproximado: ~$0.30+ (depende de la complejidad)
 *
 * Uso:
 *   node scripts/claude-sdk/04-coordinador.mjs "Agrega campo telefono al formulario de clientes"
 *   node scripts/claude-sdk/04-coordinador.mjs "Optimiza las queries del dashboard"
 *   node scripts/claude-sdk/04-coordinador.mjs "Arregla el layout del home en mobile"
 */

import { query } from "@anthropic-ai/claude-code";

const PROYECTO = "/Users/davidvaldeleon/the-monaco";
const tarea = process.argv[2];

if (!tarea) {
  console.error("Uso: node 04-coordinador.mjs \"descripcion de la tarea\"");
  process.exit(1);
}

async function coordinar() {
  console.log(`🤖 Coordinador autonomo iniciado`);
  console.log(`📋 Tarea: ${tarea}\n`);

  let sessionId;
  const inicio = Date.now();

  for await (const message of query({
    prompt: `Eres el coordinador del proyecto Monaco PRO (app SaaS de lavaderos de autos).

TAREA: ${tarea}

REGLAS:
- Lee el codigo existente antes de modificar
- Sigue los patrones del proyecto (React + Express + PostgreSQL)
- Si cambias logica de negocio, actualiza tambien aiTools.js y aiPrompt.js
- No toques archivos .env, deploy scripts, ni docker configs
- Si necesitas crear una migracion SQL, ponla en server/src/db/
- Verifica que todo compila: npm run build
- Responde en español

PROCESO:
1. Analiza que archivos necesitas tocar
2. Lee los archivos relevantes
3. Implementa los cambios
4. Verifica que compila
5. Resume lo que hiciste`,
    options: {
      allowedTools: [
        "Read",
        "Edit(src/**)",
        "Edit(server/src/**)",
        "Write(src/**)",
        "Write(server/src/**)",
        "Glob",
        "Grep",
        "Bash(npm run build*)",
        "Bash(npm test*)",
        "Bash(git diff*)",
        "Bash(git status*)",
        "Bash(node -e *)"
      ],
      disallowedTools: [
        "Bash(rm -rf*)",
        "Bash(git push*)",
        "Bash(git reset*)",
        "Bash(docker*)"
      ],
      maxTurns: 40,
      maxBudgetUsd: 1.00,
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
        if (block.type === "tool_use") {
          console.log(`\n  🔧 ${block.name}${block.input?.command ? `: ${block.input.command}` : ""}`);
        }
      }
    }

    if (message.type === "result") {
      const duracion = ((Date.now() - inicio) / 1000).toFixed(0);
      console.log(`\n\n${"=".repeat(50)}`);
      console.log(`✅ Completado en ${duracion}s`);
      console.log(`💰 Costo: $${message.total_cost_usd?.toFixed(4) || "N/A"}`);
      console.log(`🔑 Session: ${sessionId}`);

      if (message.subtype !== "success") {
        console.log(`⚠️  Estado: ${message.subtype}`);
        console.log(`   Retoma con: resume: "${sessionId}"`);
      }
    }
  }
}

coordinar().catch(console.error);
