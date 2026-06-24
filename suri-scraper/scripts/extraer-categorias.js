/**
 * extraer-categorias.js
 * Descarga el sitemap de suri-sa.com.ar y extrae todas las URLs de categorías.
 * Selector: a[id^="category-page-"]
 */


import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR   = path.resolve(__dirname, '..');
const OUTPUT     = path.join(BASE_DIR, 'categorias.txt');

const SITEMAP_URL = 'https://www.suri-sa.com.ar/Mapa%20del%20Sitio';

const HEADERS = {
  'Accept-Language': 'es-AR,es;q=0.9',
};

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SURI SCRAPER — Extractor de Categorías ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`📥  Descargando sitemap: ${SITEMAP_URL}`);

  let html;
  try {
    const response = await fetch(SITEMAP_URL, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (err) {
    console.error(`❌  Error descargando el sitemap: ${err.message}`);
    process.exit(1);
  }

  console.log('🔍  Analizando HTML...');
  const $ = cheerio.load(html);

  const urls = new Set();

  // Selector alternativo basado en la estructura de URLs de categorías de PrestaShop (ej. /123-nombre-categoria)
  $('a').each((_, el) => {
    let href = $(el).attr('href');
    if (href) {
      if (!href.startsWith('http')) {
        href = new URL(href, 'https://www.suri-sa.com.ar').toString();
      }
      try {
        const urlObj = new URL(href);
        if (
          urlObj.hostname.includes('suri-sa.com.ar') &&
          /^\/\d+-/.test(urlObj.pathname) &&
          !urlObj.pathname.endsWith('.html')
        ) {
          urls.add(href.trim());
        }
      } catch (e) {
        // Ignorar URLs inválidas
      }
    }
  });

  if (urls.size === 0) {
    console.warn('⚠️  No se encontraron categorías.');
    process.exit(1);
  }

  // Guardar resultados
  const sorted = Array.from(urls).sort();
  await fs.writeFile(OUTPUT, sorted.join('\n') + '\n', 'utf-8');

  console.log('\n══════════════════════════════════════════');
  console.log('📊  Estadísticas:');
  console.log(`    Total de categorías únicas : ${sorted.length}`);
  console.log(`    Archivo generado           : ${OUTPUT}`);
  console.log('══════════════════════════════════════════\n');
  console.log('✅  Proceso completado. Ejecutá ahora:');
  console.log('    npm run extraer-productos\n');
}

main();
