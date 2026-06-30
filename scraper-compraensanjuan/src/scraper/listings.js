import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { fetchHtml } from './fetcher.js';
import { buildAbsoluteUrl, deduplicateUrls } from '../utils/helpers.js';
import { isValidUrl, isValidPageNumber } from '../utils/validators.js';

// ─── Módulo de listados ────────────────────────────────────────────────────────
// Responsabilidad: obtener todas las URLs de propiedades del listado,
// recorriendo cada página si existe paginación.

/**
 * Construye la URL de una página específica del listado.
 * La estructura del sitio es: /listado-base/{página}
 *
 * @param {number} page - Número de página (empieza en 1)
 * @returns {string}
 */
function buildPageUrl(page) {
  return `${config.listingUrl}/${page}`;
}

/**
 * Parsea el HTML de una página de listado y extrae todos los
 * enlaces de propiedades encontrados.
 *
 * NOTA: Los selectores se ajustarán después de analizar el HTML real.
 * Se incluyen múltiples candidatos para mayor robustez.
 *
 * @param {string} html  - HTML de la página de listado
 * @param {object} $     - Instancia de Cheerio cargada con el HTML
 * @returns {string[]}   - Array de URLs absolutas de propiedades
 */
function extractPropertyUrlsFromPage($) {
  const urls = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    if (href.includes('anuncio_in/')) {
      const absolute = buildAbsoluteUrl(config.baseUrl, href);
      if (isValidUrl(absolute)) {
        urls.push(absolute);
      }
    }
  });

  return urls;
}

/**
 * Determina el número total de páginas del listado.
 * Busca el elemento de paginación y extrae el número más alto.
 * Si no encuentra paginación, asume que solo existe la página 1.
 *
 * @param {object} $ - Instancia de Cheerio cargada con el HTML de la página 1
 * @returns {number} - Total de páginas
 */
function extractTotalPages($) {
  let maxPage = 1;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/pagina=(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (isValidPageNumber(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    }
  });

  return maxPage;
}

/**
 * Obtiene todas las URLs de propiedades del listado,
 * recorriendo automáticamente todas las páginas de paginación.
 *
 * @returns {Promise<string[]>} - Array deduplicado de URLs de propiedades
 */
export async function getAllPropertyUrls() {
  logger.info('Iniciando extracción del listado de propiedades...');

  // ── Paso 1: Descargar la primera página para detectar paginación ──
  const firstPageUrl = buildPageUrl(1);
  const firstHtml = await fetchHtml(firstPageUrl);
  const $first = cheerio.load(firstHtml);

  const totalPages = extractTotalPages($first);
  logger.info(`Páginas detectadas en el listado: ${totalPages}`);

  // ── Paso 2: Recolectar URLs de la primera página ──
  const allUrls = extractPropertyUrlsFromPage($first);
  logger.info(`Página 1/${totalPages}: ${allUrls.length} propiedades encontradas`);

  // ── Paso 3: Recorrer páginas restantes ──
  for (let page = 2; page <= totalPages; page++) {
    try {
      const pageUrl = buildPageUrl(page);
      const html = await fetchHtml(pageUrl);
      const $ = cheerio.load(html);
      const pageUrls = extractPropertyUrlsFromPage($);

      logger.info(`Página ${page}/${totalPages}: ${pageUrls.length} propiedades encontradas`);
      allUrls.push(...pageUrls);
    } catch (error) {
      logger.error(`Error al procesar página ${page}: ${error.message}`);
      // No detenemos el proceso; continuamos con la siguiente página
    }
  }

  // ── Paso 4: Deduplicar y devolver ──
  const unique = deduplicateUrls(allUrls);
  logger.success(`Total de URLs únicas recolectadas: ${unique.length}`);
  return unique;
}
