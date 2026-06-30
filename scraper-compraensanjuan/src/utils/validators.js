// ─── Validadores de datos extraídos ───────────────────────────────────────────
// Funciones de guardia que validan entradas antes de procesarlas.
// Devuelven booleano; nunca lanzan excepciones.

/**
 * Verifica que una URL sea válida y use http o https.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verifica que un array de URLs de propiedades no esté vacío.
 * @param {string[]} urls
 * @returns {boolean}
 */
export function hasPropertyUrls(urls) {
  return Array.isArray(urls) && urls.length > 0;
}

/**
 * Verifica que un objeto de propiedad tenga al menos los campos obligatorios
 * mínimos para ser considerado válido (url e id).
 * @param {object} property
 * @returns {boolean}
 */
export function isValidProperty(property) {
  return (
    property !== null &&
    typeof property === 'object' &&
    typeof property.url === 'string' &&
    property.url.length > 0
  );
}

/**
 * Verifica que el número de página sea un entero positivo.
 * @param {number} page
 * @returns {boolean}
 */
export function isValidPageNumber(page) {
  return Number.isInteger(page) && page >= 1;
}
