/**
 * 01 - Analisis de codigo (READ-ONLY)
 *
 * Caso de uso: Quieres un analisis rapido de seguridad, rendimiento
 * o arquitectura sin que Claude modifique nada.
 *
 * Costo aproximado: ~$0.05
 * Tiempo: ~30 segundos
 */

import { query } from "@anthropic-ai/claude-code";

const PROYECTO = "/Users/davidvaldeleon/the-monaco";

async function analizarCodigo() {
  console.log("🔍 Analizando codigo...\n");

  const resultados = [];

  for await (const message of query({
    prompt: `Analiza el proyecto Monaco PRO y dame un reporte conciso de:
1. Vulnerabilidades de seguridad (SQL injection, XSS, auth bypass)
2. Problemas de rendimiento (queries N+1, re-renders, missing indexes)
3. Codigo duplicado que se podria refactorizar
4. Archivos que no se usan

Responde en español. Se directo, sin relleno.`,
    options: {
      allowedTools: ["Read", "Glob", "Grep"],  // Solo lectura
      maxTurns: 25,
      cwd: PROYECTO,
      settingSources: ["project"],  // Carga CLAUDE.md
      effort: "high"
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          resultados.push(block.text);
        }
      }
    }

    if (message.type === "result") {
      console.log("\n--- RESULTADO ---\n");
      console.log(resultados.join("\n"));
      console.log(`\n💰 Costo: $${message.total_cost_usd?.toFixed(4) || "N/A"}`);

      if (message.subtype !== "success") {
        console.log(`⚠️  Estado: ${message.subtype}`);
      }
    }
  }
}

analizarCodigo().catch(console.error);
