import pLimit from 'p-limit';
import { getAllPropertyUrls } from '../scraper/listings.js';
import { scrapeProperty } from '../scraper/property.js';
import { saveResults } from './storageService.js';
import { processPropertyImages } from './imageService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { hasPropertyUrls } from '../utils/validators.js';

// ─── Servicio orquestador del scraper ─────────────────────────────────────────
// Coordina el flujo completo:
//   1. Obtener URLs del listado
//   2. Scraping concurrente de propiedades
//   3. Filtrado de resultados
//   4. Guardado del JSON
//   5. Resumen final

/**
 * Ejecuta el proceso completo de scraping y devuelve las estadísticas.
 *
 * @returns {Promise<{ total: number, exitosas: number, errores: number, segundos: number }>}
 */
export async function runScraper() {
  const startTime = Date.now();

  // ── Paso 1: Obtener todas las URLs de propiedades ──
  logger.info('═══════════════════════════════════════');
  logger.info('  SCRAPER COMPRA EN SAN JUAN - STAFF  ');
  logger.info('═══════════════════════════════════════');

  const propertyUrls = await getAllPropertyUrls();

  if (!hasPropertyUrls(propertyUrls)) {
    logger.warn('No se encontraron URLs de propiedades. Verifica los selectores del listado.');
    return { total: 0, exitosas: 0, errores: 0, segundos: 0 };
  }

  logger.info(`Propiedades a procesar: ${propertyUrls.length}`);
  logger.info(`Concurrencia configurada: ${config.concurrency}`);

  // ── Paso 2: Scraping concurrente con límite ──
  const limit = pLimit(config.concurrency);

  const tasks = propertyUrls.map((url) =>
    limit(() => scrapeProperty(url))
  );

  const results = await Promise.all(tasks);

  // ── Paso 3: Separar exitosas de errores ──
  const properties = results.filter((p) => p !== null);
  const errorCount = results.length - properties.length;

  // ── Paso 4: Descarga de imágenes (opcional) ──
  if (config.downloadImages) {
    logger.info(`Iniciando descarga de imágenes (Concurrencia: ${config.imageConcurrency})...`);
    const imgLimit = pLimit(config.imageConcurrency);
    
    const imgTasks = properties.map((p) =>
      imgLimit(async () => {
        p.imagenesLocales = await processPropertyImages(p, config.outputDir);
      })
    );
    await Promise.all(imgTasks);
    logger.success('Descarga de imágenes completada.');
  }

  // ── Paso 5: Guardar resultados ──
  await saveResults(properties);

  // ── Paso 6: Calcular estadísticas ──
  const segundos = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    total:    propertyUrls.length,
    exitosas: properties.length,
    errores:  errorCount,
    segundos: parseFloat(segundos),
  };
}
