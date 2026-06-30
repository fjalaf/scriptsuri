import 'dotenv/config';

// ─── Configuración central del proyecto ───────────────────────────────────────
// Todas las constantes de comportamiento del scraper se leen desde .env
// con valores por defecto razonables para cada una.

export const config = {
  // URL base del sitio (sin trailing slash)
  baseUrl: process.env.BASE_URL ?? 'https://www.compraensanjuan.com',

  // URL del listado de propiedades (sin número de página)
  listingUrl:
    process.env.LISTING_URL ??
    'https://www.compraensanjuan.com/tienda-virtual/anuncios-listado/69047/inmobiliaria-staff/11',

  // Límite de requests concurrentes para no sobrecargar el servidor
  concurrency: parseInt(process.env.CONCURRENCY ?? '3', 10),

  // Pausa entre requests individuales (ms)
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS ?? '500', 10),

  // Timeout por request (ms)
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '15000', 10),

  // Carpeta donde se guardará el JSON de salida
  outputDir: process.env.OUTPUT_DIR ?? 'output',

  // Nombre del archivo de salida
  outputFile: process.env.OUTPUT_FILE ?? 'properties.json',

  // Descarga de imágenes
  downloadImages: process.env.DOWNLOAD_IMAGES === 'true',

  // Concurrencia de descarga de imágenes
  imageConcurrency: parseInt(process.env.IMAGE_CONCURRENCY ?? '5', 10),

  // Headers para simular un navegador real y evitar bloqueos básicos
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
  },
};
