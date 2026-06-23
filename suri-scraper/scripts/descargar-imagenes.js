/**
 * descargar-imagenes.js
 * Lee productos.txt, visita cada producto, extrae imagen principal y nombre,
 * descarga la imagen y la convierte directamente a WebP (sin JPG temporal).
 *
 * Dependencias: axios, cheerio, sharp, p-limit
 *
 * Selectores verificados en suri-sa.com.ar (PrestaShop + tema antomi4):
 *   Imagen : .product-cover img[itemprop="image"]  → atributo src
 *   Nombre : h1.namne_details[itemprop="name"]     → textContent
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..');

// ── Configuración ────────────────────────────────────────────────────────────
const CONFIG = {
  productosFile: path.join(BASE_DIR, 'productos.txt'),
  procesadosFile: path.join(BASE_DIR, 'procesados.txt'),
  erroresFile: path.join(BASE_DIR, 'errores.txt'),
  outputDir: path.join(BASE_DIR, 'imagenes-webp'),

  webpQuality: 85,
  concurrency: 10,
  timeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 2_000,

  // Apple Silicon M4 Pro: sharp usa libvips con soporte nativo ARM64.
  // Los workers se ajustan automáticamente. No es necesario configurar nada extra.
};

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

/**
 * Limpia el nombre del producto para usarlo como nombre de archivo.
 * Elimina caracteres inválidos en nombres de archivo (macOS / Linux / Windows).
 */
function sanitizeFilename(name) {
  return name
    .trim()
    .normalize('NFD')                         // descomponer acentos
    .replace(/[\u0300-\u036f]/g, '')          // eliminar diacríticos
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')   // caracteres inválidos
    .replace(/\s+/g, '_')                     // espacios → guión bajo
    .replace(/[^a-zA-Z0-9_\-().]/g, '')      // solo alfanuméricos y seguros
    .replace(/_+/g, '_')                      // reducir guiones bajos múltiples
    .slice(0, 200)                            // máximo 200 caracteres
    || 'producto_sin_nombre';
}

async function fetchHtmlWithRetry(url) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: HEADERS,
        decompress: true,
        timeout: CONFIG.timeoutMs,
      });
      return res.data;
    } catch (err) {
      if (attempt === CONFIG.maxRetries) throw err;
      await sleep(CONFIG.retryDelayMs * attempt);
    }
  }
}

/**
 * Descarga la imagen como buffer en memoria con reintentos.
 */
async function downloadImageBuffer(imageUrl) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const res = await axios.get(imageUrl, {
        headers: { ...HEADERS, Accept: 'image/webp,image/apng,image/*,*/*' },
        responseType: 'arraybuffer',
        timeout: CONFIG.timeoutMs,
      });
      return Buffer.from(res.data);
    } catch (err) {
      if (attempt === CONFIG.maxRetries) throw err;
      await sleep(CONFIG.retryDelayMs * attempt);
    }
  }
}

/**
 * Extrae imagen principal y nombre del producto de la página HTML.
 *
 * Selectores verificados (PrestaShop + tema antomi4):
 *  - Imagen: .product-cover img[itemprop="image"]  (primera imagen del slider principal)
 *  - Nombre: h1.namne_details                      (typo del tema, intencional)
 *
 * Fallbacks incluidos para mayor robustez.
 */
function extractProductData(html, productUrl) {
  const $ = cheerio.load(html);

  // ── Nombre del producto ──────────────────────────────────────────────────
  let nombre =
    $('h1.namne_details[itemprop="name"]').text().trim() ||
    $('h1[itemprop="name"]').text().trim() ||
    $('h1.product-name').text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().split('|')[0].trim();

  // ── URL de imagen principal ──────────────────────────────────────────────
  // Prioridad: imagen large_default del slider principal (mayor resolución)
  let imageUrl =
    $('.product-cover img[itemprop="image"]').attr('src') ||
    $('.product-cover img').first().attr('src') ||
    // Fallback: primera imagen con itemprop="image"
    $('img[itemprop="image"]').first().attr('src') ||
    // Fallback: data-src (lazy load)
    $('.product-cover img').first().attr('data-src');

  // Asegurar URL absoluta
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, 'https://www.suri-sa.com.ar').toString();
  }

  // Preferir la versión large_default si la URL contiene otro tamaño
  if (imageUrl) {
    imageUrl = imageUrl
      .replace(/-(home|medium|small|cart|homeslider)_default\//, '-large_default/');
  }

  return { nombre, imageUrl };
}

// ── Leer/escribir archivos de estado ─────────────────────────────────────────

async function cargarProcesados() {
  try {
    const content = await fs.readFile(CONFIG.procesadosFile, 'utf-8');
    return new Set(content.split('\n').map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function registrarProcesado(productUrl) {
  await fs.appendFile(CONFIG.procesadosFile, productUrl + '\n', 'utf-8');
}

async function registrarError(productUrl, motivo) {
  const timestamp = new Date().toISOString();
  await fs.appendFile(
    CONFIG.erroresFile,
    `[${timestamp}] ${productUrl}\n  → ${motivo}\n\n`,
    'utf-8'
  );
}

// ── Proceso por producto ──────────────────────────────────────────────────────

async function procesarProducto(productUrl, procesados, stats, bar) {
  // Omitir si ya fue procesado
  if (procesados.has(productUrl)) {
    stats.omitidos++;
    bar.increment(1, formatStats(stats));
    return;
  }

  try {
    // 1. Descargar HTML del producto
    const html = await fetchHtmlWithRetry(productUrl);
    const { nombre, imageUrl } = extractProductData(html, productUrl);

    if (!imageUrl) {
      throw new Error('No se encontró URL de imagen principal');
    }
    if (!nombre) {
      throw new Error('No se encontró nombre del producto');
    }

    // 2. Calcular nombre del archivo de salida
    const filename = sanitizeFilename(nombre) + '.webp';
    const outputPath = path.join(CONFIG.outputDir, filename);

    // 3. Omitir si el WebP ya existe
    try {
      await fs.access(outputPath);
      // El archivo existe → omitir
      await registrarProcesado(productUrl);
      procesados.add(productUrl);
      stats.omitidos++;
      bar.increment(1, formatStats(stats));
      return;
    } catch {
      // El archivo no existe → continuar
    }

    // 4. Descargar imagen como buffer (sin guardar JPG temporal)
    const imageBuffer = await downloadImageBuffer(imageUrl);

    // 5. Convertir directamente a WebP con sharp (optimizado para Apple Silicon)
    await sharp(imageBuffer)
      .webp({ quality: CONFIG.webpQuality, effort: 4 })
      .toFile(outputPath);

    // 6. Registrar como procesado
    await registrarProcesado(productUrl);
    procesados.add(productUrl);

    stats.exitosos++;
    bar.increment(1, formatStats(stats));
  } catch (err) {
    stats.errores++;
    await registrarError(productUrl, err.message);
    bar.increment(1, formatStats(stats));
  }
}

function formatStats(stats) {
  const total = stats.exitosos + stats.errores + stats.omitidos;
  const pct = stats.total > 0
    ? ((total / stats.total) * 100).toFixed(1)
    : '0.0';
  return {
    exitosos: stats.exitosos,
    errores: stats.errores,
    omitidos: stats.omitidos,
    pct,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   SURI SCRAPER — Descarga y Conversión a WebP    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Leer productos
  let productos;
  try {
    const content = await fs.readFile(CONFIG.productosFile, 'utf-8');
    productos = content.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    console.error(`❌  No se encontró ${CONFIG.productosFile}`);
    console.error('    Ejecutá primero: npm run extraer-productos');
    process.exit(1);
  }

  if (productos.length === 0) {
    console.error('❌  La lista de productos está vacía.');
    process.exit(1);
  }

  // Crear directorio de salida
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Cargar procesados previos (reanudación)
  const procesados = await cargarProcesados();
  const pendientes = productos.filter((url) => !procesados.has(url));

  console.log(`📦  Total de productos    : ${productos.length}`);
  console.log(`✅  Ya procesados         : ${procesados.size}`);
  console.log(`⏳  Pendientes            : ${pendientes.length}`);
  console.log(`⚡  Concurrencia          : ${CONFIG.concurrency}`);
  console.log(`🖼️   Calidad WebP          : ${CONFIG.webpQuality}`);
  console.log(`📁  Carpeta de salida     : ${CONFIG.outputDir}\n`);

  if (pendientes.length === 0) {
    console.log('✅  Todos los productos ya fueron procesados.');
    return;
  }

  const stats = {
    total: pendientes.length,
    exitosos: 0,
    errores: 0,
    omitidos: 0,
  };

  // Barra de progreso multi-línea con estadísticas detalladas
  const bar = new cliProgress.SingleBar(
    {
      format:
        '  Progreso |{bar}| {percentage}% | {value}/{total}\n' +
        '  ✅ {exitosos} exitosos  ❌ {errores} errores  ⏭️  {omitidos} omitidos  📊 {pct}% completado',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      clearOnComplete: false,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  const startTime = Date.now();
  bar.start(pendientes.length, 0, formatStats(stats));

  const limit = pLimit(CONFIG.concurrency);
  const tareas = pendientes.map((url) =>
    limit(() => procesarProducto(url, procesados, stats, bar))
  );

  await Promise.all(tareas);
  bar.stop();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const velocidad = (stats.exitosos / (elapsed / 60)).toFixed(1);

  console.log('\n══════════════════════════════════════════════════');
  console.log('📊  Resumen final:');
  console.log(`    ✅  Imágenes convertidas : ${stats.exitosos}`);
  console.log(`    ❌  Errores              : ${stats.errores}`);
  console.log(`    ⏭️   Omitidos             : ${stats.omitidos}`);
  console.log(`    ⏱️   Tiempo total         : ${elapsed}s`);
  console.log(`    🚀  Velocidad            : ${velocidad} productos/min`);
  console.log(`    📁  Directorio de salida : ${CONFIG.outputDir}`);
  if (stats.errores > 0) {
    console.log(`    📋  Log de errores       : ${CONFIG.erroresFile}`);
  }
  console.log('══════════════════════════════════════════════════\n');
  console.log('✅  Proceso completado.\n');
}

main();
