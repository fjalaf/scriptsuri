/**
 * extraer-categorias.js
 * Descarga el sitemap de suri-sa.com.ar y extrae todas las URLs de categorías.
 * Selector: a[id^="category-page-"]
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR   = path.resolve(__dirname, '..');
const OUTPUT     = path.join(BASE_DIR, 'categorias.txt');

const SITEMAP_URL = 'https://www.suri-sa.com.ar/Mapa%20del%20Sitio';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Accept-Encoding': 'gzip, deflate',
};

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SURI SCRAPER — Extractor de Categorías ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`📥  Descargando sitemap: ${SITEMAP_URL}`);

  let html;
  try {
    const response = await axios.get(SITEMAP_URL, {
      headers: HEADERS,
      decompress: true,
      timeout: 30_000,
    });
    html = response.data;
  } catch (err) {
    console.error(`❌  Error descargando el sitemap: ${err.message}`);
    process.exit(1);
  }

  console.log('🔍  Analizando HTML...');
  const $ = cheerio.load(html);

  const urls = new Set();

  // Selector principal: <a id="category-page-NNN" href="...">
  $('a[id^="category-page-"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http')) {
      urls.add(href.trim());
    }
  });

  if (urls.size === 0) {
    console.warn('⚠️  No se encontraron categorías con el selector principal.');
    console.warn('    Verificá que el sitemap esté disponible y que el selector sea correcto.');
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
