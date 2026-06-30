import { fetchHtml } from './fetcher.js';
import { parseProperty } from './parser.js';
import { logger } from '../utils/logger.js';
import { isValidUrl } from '../utils/validators.js';

// ─── Módulo de scraping individual de propiedades ─────────────────────────────
// Responsabilidad: descargar y parsear una sola propiedad.
// Aísla el manejo de error por propiedad del flujo principal.

/**
 * Descarga el HTML de una propiedad, lo parsea y devuelve
 * el objeto normalizado.
 *
 * Si la descarga o el parseo fallan, registra el error y devuelve null
 * para que el llamador (scraperService) lo contabilice como error
 * sin detener el proceso.
 *
 * @param {string} url - URL completa de la página de detalle
 * @returns {Promise<object|null>} - Objeto propiedad o null si falló
 */
export async function scrapeProperty(url) {
  if (!isValidUrl(url)) {
    logger.warn(`URL inválida, se omite: ${url}`);
    return null;
  }

  try {
    const html = await fetchHtml(url);
    const property = parseProperty(html, url);
    logger.success(`Procesada: ${property.titulo ?? url}`);
    return property;
  } catch (error) {
    logger.error(`Error al procesar propiedad ${url}: ${error.message}`);
    return null;
  }
}
