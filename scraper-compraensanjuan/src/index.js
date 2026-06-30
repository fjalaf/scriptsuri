import 'dotenv/config';
import { runScraper } from './services/scraperService.js';
import { logger } from './utils/logger.js';

// ─── Punto de entrada de la aplicación ────────────────────────────────────────
// Responsabilidad: iniciar el proceso y mostrar el resumen final.
// No contiene lógica de negocio; delega todo al scraperService.

async function main() {
  try {
    const stats = await runScraper();

    // ── Resumen final ──
    logger.summary('══════════════════════════════════');
    logger.summary('           RESUMEN FINAL          ');
    logger.summary('══════════════════════════════════');
    logger.summary(`Propiedades encontradas:    ${stats.total}`);
    logger.summary(`Procesadas correctamente:   ${stats.exitosas}`);
    logger.summary(`Con errores:                ${stats.errores}`);
    logger.summary(`Tiempo total:               ${stats.segundos} segundos`);
    logger.summary('══════════════════════════════════');

    // Código de salida no-cero si hubo errores (útil para CI/CD)
    if (stats.errores > 0) {
      logger.warn(`${stats.errores} propiedad(es) no pudieron procesarse. Revisa los logs.`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`Error fatal en la ejecución: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
