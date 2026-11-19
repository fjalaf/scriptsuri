import axios from 'axios';
import { BASE_URL, USER_AGENT } from './config.js';

// El sitio es una SPA (Vite/React): el HTML sólo trae <div id="root"> y el
// catálogo vive como un array literal dentro del bundle JS. Se descarga el
// bundle en lugar de usar un navegador headless.

const client = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': USER_AGENT },
  maxRedirects: 5,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url, { retries = 2, delayMs = 500 } = {}) {
  for (let intento = 1; intento <= retries + 1; intento++) {
    try {
      const response = await client.get(url);
      return response.data;
    } catch (error) {
      const status = error.response?.status ?? 'sin respuesta';
      const esUltimoIntento = intento === retries + 1;
      console.warn(
        `  ⚠ intento ${intento}/${retries + 1} falló para ${url} — HTTP ${status}: ${error.message}`
      );
      if (esUltimoIntento) throw error;
      await sleep(delayMs);
    }
  }
}

/**
 * Descarga el bundle JS principal que contiene el catálogo.
 * El nombre del bundle lleva un hash que cambia en cada build, por eso se
 * lee del <script type="module" src="..."> del index.html.
 * @returns {Promise<string>} código fuente del bundle
 */
export async function getBundle() {
  const html = await get(BASE_URL);
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/);
  if (!match) throw new Error('No se encontró el bundle JS en el index.html');

  const bundleUrl = new URL(match[1], BASE_URL).href;
  console.log(`Bundle: ${bundleUrl}`);
  return get(bundleUrl);
}
