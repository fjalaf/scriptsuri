// ─── Helpers genéricos reutilizables ──────────────────────────────────────────
// Funciones puras sin efectos secundarios.
// Cada una tiene una única responsabilidad bien definida.

/**
 * Espera un número de milisegundos antes de continuar.
 * Úsala entre requests para no saturar el servidor.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Limpia un string: elimina espacios al inicio/fin y reduce espacios internos.
 * Devuelve null si el resultado queda vacío.
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function cleanText(text) {
  if (text == null) return null;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Intenta parsear un número entero desde un string.
 * Devuelve null si no encuentra dígitos.
 * @param {string|null|undefined} text
 * @returns {number|null}
 */
export function parseIntOrNull(text) {
  if (text == null) return null;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Intenta parsear un número decimal desde un string.
 * Normaliza separadores de miles (.) y decimales (,) al formato JS.
 * Devuelve null si no puede parsear.
 * @param {string|null|undefined} text
 * @returns {number|null}
 */
export function parseFloatOrNull(text) {
  if (text == null) return null;
  // Normaliza "1.500,50" → "1500.50"
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const match = normalized.match(/[\d.]+/);
  if (!match) return null;
  const value = parseFloat(match[0]);
  return isNaN(value) ? null : value;
}

/**
 * Construye una URL absoluta a partir de una base y un path relativo.
 * Si el path ya es absoluto, lo devuelve sin modificar.
 * @param {string} base  - URL base (ej: "https://ejemplo.com")
 * @param {string} path  - Path relativo o absoluto
 * @returns {string}
 */
export function buildAbsoluteUrl(base, path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Elimina URLs duplicadas de un array.
 * @param {string[]} urls
 * @returns {string[]}
 */
export function deduplicateUrls(urls) {
  return [...new Set(urls)];
}

/**
 * Extrae el precio y la moneda de un string como "$120.000" o "USD 85.000".
 * @param {string|null} text
 * @returns {{ precio: string|null, moneda: string|null }}
 */
export function extractPriceAndCurrency(text) {
  if (!text) return { precio: null, moneda: null };

  const usdMatch = text.match(/USD|U\$S|u\$s/i);
  const arsMatch = text.match(/\$|ARS/i);

  const moneda = usdMatch ? 'USD' : arsMatch ? 'ARS' : null;

  // Extrae solo los dígitos y separadores del precio
  const priceMatch = text.match(/[\d.,]+/);
  const precio = priceMatch ? priceMatch[0] : null;

  return { precio, moneda };
}

/**
 * Convierte un texto en un slug amigable para SEO en formato kebab-case.
 * @param {string} text
 * @returns {string}
 */
export function generateSeoSlug(text) {
  if (!text) return 'propiedad';
  return text
    .toString()
    .normalize('NFD')                   // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')    // Elimina diacríticos (acentos)
    .toLowerCase()                      // Convierte a minúsculas
    .trim()                             // Elimina espacios extra
    .replace(/\s+/g, '-')               // Reemplaza espacios por guiones
    .replace(/[^\w-]+/g, '')            // Elimina todo lo que no sea palabra, número o guión
    .replace(/--+/g, '-');              // Reemplaza múltiples guiones por uno solo
}

/**
 * Extrae la extensión de un archivo a partir de una URL,
 * ignorando query parameters (ej: .jpg?v=123 -> .jpg).
 * @param {string} url
 * @returns {string}
 */
export function extractExtension(url) {
  if (!url) return '.jpg'; // Fallback por defecto
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.[0-9a-z]+$/i);
    return match ? match[0].toLowerCase() : '.jpg';
  } catch (e) {
    // Si no es una URL válida, buscar directamente el patrón
    const match = url.split('?')[0].match(/\.[0-9a-z]+$/i);
    return match ? match[0].toLowerCase() : '.jpg';
  }
}
