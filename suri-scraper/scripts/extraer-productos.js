/**
 * extraer-productos.js
 * Lee categorias.txt y recorre todas las páginas de cada categoría
 * extrayendo las URLs de productos. Soporta miles de productos.
 *
 * Dependencias: axios, cheerio, p-limit, cli-progress
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR   = path.resolve(__dirname, '..');

const CATEGORIAS_FILE = path.join(BASE_DIR, 'categorias.txt');
const PRODUCTOS_FILE  = path.join(BASE_DIR, 'productos.txt');

// ── Configuración ───────────────────────────────────────────────────────────
const CONCURRENCY   = 5;   // peticiones paralelas por categoría
const PAGE_DELAY_MS = 300; // pausa entre páginas (ms) para no saturar el servidor
const TIMEOUT_MS    = 25_000;
const MAX_RETRIES   = 3;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
};

// ── Utilidades ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, decompress: true, timeout: TIMEOUT_MS });
      return res.data;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

/**
 * Extrae las URLs de productos de una página de categoría.
 * PrestaShop usa el selector: article.product-miniature a.product-thumbnail
 */
function extractProductUrls($) {
  const urls = new Set();

  // Selector principal PrestaShop
  $('article.product-miniature a.product-thumbnail').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('suri-sa.com.ar')) {
      urls.add(href.trim());
    }
  });

  // Fallback: cualquier enlace a un .html dentro de /img/p/ o con id de producto
  if (urls.size === 0) {
    $('a[href*=".html"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Las URLs de producto suelen tener un número antes del guión y terminan en .html
      if (/\/\d+-[a-z0-9-]+\.html$/.test(href) && href.includes('suri-sa.com.ar')) {
        urls.add(href.trim());
      }
    });
  }

  return urls;
}

/**
 * Detecta cuántas páginas tiene una categoría.
 * PrestaShop usa: .pagination .page-list li a o input#search_filters_offset
 */
function detectTotalPages($) {
  // Intento 1: último número de página visible en el paginador
  let maxPage = 1;

  $('.pagination .page-list li a, .pagination li a').each((_, el) => {
    const text = $(el).text().trim();
    const n = parseInt(text, 10);
    if (!isNaN(n) && n > maxPage) maxPage = n;
  });

  // Intento 2: atributo data-* en el paginador
  if (maxPage === 1) {
    const totalStr =
      $('[data-total-pages]').attr('data-total-pages') ||
      $('[data-pages-count]').attr('data-pages-count');
    if (totalStr) {
      const n = parseInt(totalStr, 10);
      if (!isNaN(n) && n > 1) maxPage = n;
    }
  }

  return maxPage;
}

/**
 * Construye la URL de una página específica de una categoría.
 * PrestaShop standard: ?p=N
 */
function buildPageUrl(categoryUrl, page) {
  if (page === 1) return categoryUrl;
  const url = new URL(categoryUrl);
  url.searchParams.set('p', page);
  return url.toString();
}

// ── Proceso principal ─────────────────────────────────────────────────────────

async function procesarCategoria(categoryUrl, productosGlobales, onProduct) {
  // Obtener primera página
  let html;
  try {
    html = await fetchWithRetry(categoryUrl);
  } catch (err) {
    console.error(`\n  ⚠️  Error en categoría: ${categoryUrl} → ${err.message}`);
    return;
  }

  let $ = cheerio.load(html);
  const totalPages = detectTotalPages($);
  const productosEnPagina = extractProductUrls($);

  productosEnPagina.forEach((url) => {
    if (!productosGlobales.has(url)) {
      productosGlobales.add(url);
      onProduct(url);
    }
  });

  // Si hay más páginas, recorremos
  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page++) {
      await sleep(PAGE_DELAY_MS);
      const pageUrl = buildPageUrl(categoryUrl, page);
      try {
        const pageHtml = await fetchWithRetry(pageUrl);
        $ = cheerio.load(pageHtml);
        const prods = extractProductUrls($);
        prods.forEach((url) => {
          if (!productosGlobales.has(url)) {
            productosGlobales.add(url);
            onProduct(url);
          }
        });
      } catch (err) {
        console.error(`\n  ⚠️  Error en página ${page} de ${categoryUrl}: ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SURI SCRAPER — Extractor de Productos  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Leer categorías
  let categorias;
  try {
    const content = await fs.readFile(CATEGORIAS_FILE, 'utf-8');
    categorias = content.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    console.error(`❌  No se encontró ${CATEGORIAS_FILE}`);
    console.error('    Ejecutá primero: npm run extraer-categorias');
    process.exit(1);
  }

  console.log(`📂  Categorías a procesar: ${categorias.length}`);
  console.log(`⚡  Concurrencia          : ${CONCURRENCY}\n`);

  const productosGlobales = new Set();
  const writtenUrls       = [];

  // Barra de progreso de categorías
  const bar = new cliProgress.SingleBar(
    {
      format: '  Categorías |{bar}| {value}/{total} | Productos: {productos}',
      clearOnComplete: false,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  bar.start(categorias.length, 0, { productos: 0 });

  const limit = pLimit(CONCURRENCY);
  const tareas = categorias.map((cat) =>
    limit(async () => {
      await procesarCategoria(cat, productosGlobales, (url) => {
        writtenUrls.push(url);
      });
      bar.increment(1, { productos: productosGlobales.size });
    })
  );

  await Promise.all(tareas);
  bar.stop();

  // Guardar resultados
  const sorted = Array.from(productosGlobales).sort();
  await fs.writeFile(PRODUCTOS_FILE, sorted.join('\n') + '\n', 'utf-8');

  console.log('\n══════════════════════════════════════════');
  console.log('📊  Estadísticas:');
  console.log(`    Categorías procesadas : ${categorias.length}`);
  console.log(`    Productos únicos      : ${sorted.length}`);
  console.log(`    Archivo generado      : ${PRODUCTOS_FILE}`);
  console.log('══════════════════════════════════════════\n');
  console.log('✅  Proceso completado. Ejecutá ahora:');
  console.log('    npm run descargar-imagenes\n');
}

main();
