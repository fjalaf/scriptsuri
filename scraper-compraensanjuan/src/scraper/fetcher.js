import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

// ─── Cliente HTTP centralizado ─────────────────────────────────────────────────
// Toda comunicación con el sitio pasa por aquí.
// Esto garantiza que los headers, timeout y comportamiento de error
// sean siempre consistentes.

const client = axios.create({
  timeout: config.requestTimeoutMs,
  headers: config.headers,
  // Seguir redirecciones automáticamente
  maxRedirects: 5,
});

/**
 * Descarga el HTML de una URL y devuelve el contenido como string.
 * Incluye un delay configurable para no sobrecargar el servidor.
 * En caso de error, registra el problema y relanza la excepción
 * para que el llamador decida cómo manejarlo.
 *
 * @param {string} url - URL completa a descargar
 * @returns {Promise<string>} - HTML de la página
 * @throws {Error} si la request falla después de agotar el timeout
 */
export async function fetchHtml(url) {
  logger.info(`GET ${url}`);

  // Pausa cortesía entre requests
  await sleep(config.requestDelayMs);

  try {
    const response = await client.get(url, {
      responseType: 'text',
    });

    return response.data;
  } catch (error) {
    const status = error.response?.status ?? 'sin respuesta';
    logger.error(`Falló GET ${url} — HTTP ${status}: ${error.message}`);
    throw error;
  }
}
