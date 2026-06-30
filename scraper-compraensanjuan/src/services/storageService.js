import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

// ─── Servicio de almacenamiento ────────────────────────────────────────────────
// Responsabilidad: persistir los resultados en disco.
// Aísla toda la lógica de I/O del resto de la aplicación.

/**
 * Construye la ruta absoluta del archivo de salida.
 * La ruta es relativa al directorio raíz del proyecto.
 *
 * @returns {string}
 */
function buildOutputPath() {
  // process.cwd() apunta a la raíz del proyecto cuando se ejecuta con `npm start`
  return path.join(process.cwd(), config.outputDir, config.outputFile);
}

/**
 * Crea el directorio de salida si no existe.
 *
 * @param {string} filePath - Ruta completa del archivo de salida
 * @returns {Promise<void>}
 */
async function ensureOutputDir(filePath) {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
}

/**
 * Serializa el array de propiedades a JSON con formato legible
 * y lo guarda en disco.
 *
 * @param {object[]} properties - Array de propiedades normalizadas
 * @returns {Promise<void>}
 */
export async function saveResults(properties) {
  const outputPath = buildOutputPath();

  await ensureOutputDir(outputPath);

  const json = JSON.stringify(properties, null, 2);
  await writeFile(outputPath, json, 'utf-8');

  logger.success(`Resultados guardados en: ${outputPath}`);
  logger.info(`Total de propiedades en el archivo: ${properties.length}`);
}
