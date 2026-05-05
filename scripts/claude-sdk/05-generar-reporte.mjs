/**
 * 05 - Generar reporte de estado del proyecto
 *
 * Caso de uso: Quieres un resumen ejecutivo de como va el proyecto.
 * Analiza codigo, git history, TODOs, y genera un reporte.
 *
 * Costo aproximado: ~$0.10
 *
 * Uso: node scripts/claude-sdk/05-generar-reporte.mjs
 */

import { query } from "@anthropic-ai/claude-code";
import { writeFileSync } from "fs";

const PROYECTO = "/Users/davidvaldeleon/the-monaco";

async function generarReporte() {
  console.log("📊 Generando reporte del proyecto...\n");

  let reporteFinal = "";

  for await (const message of query({
    prompt: `Genera un reporte de estado del proyecto Monaco PRO. Investiga:

1. **Git Activity** — ultimos 10 commits, que se ha trabajado
2. **Archivos modificados sin commit** — git status
3. **TODOs y FIXMEs** — busca en el codigo
4. **Dependencias desactualizadas** — revisa package.json
5. **Tamano del bundle** — si hay build, revisa dist/
6. **Cobertura de features** — que modulos estan completos vs en progreso
7. **Deuda tecnica** — patrones inconsistentes, codigo legacy

Formato del reporte:
# Monaco PRO — Reporte de Estado
## Fecha: [hoy]
## Resumen Ejecutivo
[3 lineas max]
## Actividad Reciente
## Estado de Modulos
## Deuda Tecnica
## Proximos Pasos Recomendados

Responde en español.`,
    options: {
      allowedTools: [
        "Read",
        "Glob",
        "Grep",
        "Bash(git log*)",
        "Bash(git status*)",
        "Bash(git diff --stat*)",
        "Bash(wc -l*)",
        "Bash(du -sh*)",
        "Bash(ls -la*)"
      ],
      maxTurns: 25,
      cwd: PROYECTO,
      settingSources: ["project"],
      effort: "high"
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          reporteFinal += block.text;
          process.stdout.write(block.text);
        }
      }
    }

    if (message.type === "result") {
      // Guardar reporte en archivo
      const fecha = new Date().toISOString().split("T")[0];
      const archivo = `${PROYECTO}/scripts/claude-sdk/reportes/reporte-${fecha}.md`;

      try {
        writeFileSync(archivo, reporteFinal);
        console.log(`\n\n📁 Reporte guardado en: ${archivo}`);
      } catch {
        // Si no existe el directorio reportes, no pasa nada
        console.log("\n\n(Crea scripts/claude-sdk/reportes/ para guardar reportes automaticamente)");
      }

      console.log(`💰 Costo: $${message.total_cost_usd?.toFixed(4) || "N/A"}`);
    }
  }
}

generarReporte().catch(console.error);
