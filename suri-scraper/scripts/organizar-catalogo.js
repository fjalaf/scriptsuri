/**
 * organizar-catalogo.js
 * Descarga descripciones y organiza el catálogo web
 */

import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// ── Configuración ────────────────────────────────────────────────────────────

const CONFIG = {
  inputFile: path.join(process.cwd(), 'productos.txt'),
  progressFile: path.join(process.cwd(), 'procesados_catalogo.txt'),
  errorsFile: path.join(process.cwd(), 'errores_catalogo.txt'),
  outputDir: path.join(process.cwd(), 'catalogo-estructurado'),
  imagesDir: path.join(process.cwd(), 'imagenes-webp'),
  jsonFile: path.join(process.cwd(), 'catalogo-estructurado', 'catalogo.json'),
  concurrency: 10,
  timeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 2000,
};

const HEADERS = {
  'Accept-Language': 'es-AR,es;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── Utilidades ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtmlWithRetry(url) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(CONFIG.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === CONFIG.maxRetries) throw err;
      await sleep(CONFIG.retryDelayMs * attempt);
    }
  }
}

function sanitizeForPath(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim() || 'Desconocido';
}

function getWebpFileName(productName) {
  // Misma lógica exacta que usar descargar-imagenes.js
  return productName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .replace(/^_|_$/g, '');
}

// ── Lógica Principal ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   SURI SCRAPER — Estructuración de Catálogo      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  try {
    await fs.access(CONFIG.inputFile);
  } catch {
    console.error(`❌  No se encontró ${CONFIG.inputFile}. Ejecutá el scraper de productos primero.`);
    process.exit(1);
  }

  // Asegurar directorios
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const rawData = await fs.readFile(CONFIG.inputFile, 'utf-8');
  const allUrls = rawData.split('\n').filter((l) => l.trim().startsWith('http'));

  let procesados = new Set();
  try {
    const procData = await fs.readFile(CONFIG.progressFile, 'utf-8');
    procesados = new Set(procData.split('\n').filter(Boolean));
  } catch (e) {
    // No existe procesados_catalogo.txt
  }

  const urlsToProcess = allUrls.filter((url) => !procesados.has(url));

  console.log(`📦  Total de productos    : ${allUrls.length}`);
  console.log(`✅  Ya estructurados      : ${procesados.size}`);
  console.log(`⏳  Pendientes            : ${urlsToProcess.length}`);
  
  if (urlsToProcess.length === 0) {
    console.log('\n✅  Todos los productos ya fueron estructurados.');
    return;
  }

  const limit = pLimit(CONFIG.concurrency);
  const bar = new cliProgress.SingleBar({
    format: 'Extrayendo [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} prod | {status}',
    clearOnComplete: false,
  }, cliProgress.Presets.shades_classic);

  bar.start(urlsToProcess.length, 0, { status: 'Iniciando...' });

  let successCount = 0;
  let errorCount = 0;
  
  // Cargar el JSON actual si existe
  let catalogoGlobal = [];
  try {
    const jsonStr = await fs.readFile(CONFIG.jsonFile, 'utf-8');
    catalogoGlobal = JSON.parse(jsonStr);
  } catch (e) {
    // Archivo nuevo
  }

  const tasks = urlsToProcess.map((url) =>
    limit(async () => {
      try {
        const html = await fetchHtmlWithRetry(url);
        const $ = cheerio.load(html);

        // 1. Obtener Nombre Exacto (para la imagen previa)
        const productName = $('h1.namne_details[itemprop="name"]').text().trim() || $('h1[itemprop="name"]').text().trim();
        if (!productName) throw new Error('No se encontró el nombre del producto');

        // 2. Extraer objeto PrestaShop de Javascript
        let category = 'General';
        let subcategory = 'General';
        
        const scriptTags = $('script').filter((i, el) => {
          const content = $(el).html() || '';
          return content.includes('var prestashop = {');
        });

        if (scriptTags.length > 0) {
          const scriptContent = $(scriptTags[0]).html();
          const match = scriptContent.match(/var prestashop = ({.*});/s);
          if (match && match[1]) {
            try {
              const psData = JSON.parse(match[1]);
              if (psData.breadcrumb && psData.breadcrumb.links) {
                const links = psData.breadcrumb.links;
                if (links.length >= 2) category = links[1].title;
                if (links.length >= 3) {
                    if(links.length === 3) {
                        subcategory = 'General'; // Solo Inicio > Categoria > Producto
                    } else {
                        subcategory = links[2].title;
                    }
                }
              }
            } catch (e) {
                // Ignore parse errors
            }
          }
        }

        // 3. Obtener la descripción HTML
        const descriptionHtml = $('#description .product-description').html() || '';

        // 4. Crear rutas de carpetas sanitizadas
        const safeCat = sanitizeForPath(category);
        const safeSubCat = sanitizeForPath(subcategory);
        const safeProd = sanitizeForPath(productName);
        
        const productDir = path.join(CONFIG.outputDir, 'categorias', safeCat, safeSubCat, safeProd);
        await fs.mkdir(productDir, { recursive: true });

        // 5. Mover/Copiar la imagen WebP existente
        const imgName = getWebpFileName(productName);
        const sourceImage = path.join(CONFIG.imagesDir, `${imgName}.webp`);
        const targetImage = path.join(productDir, 'imagen.webp');
        
        try {
            await fs.copyFile(sourceImage, targetImage);
        } catch (e) {
            // Si la imagen no está (omisiones, etc.), no fallar el proceso completo
        }

        // 6. Escribir descripción HTML
        const descFile = path.join(productDir, 'descripcion.html');
        await fs.writeFile(descFile, descriptionHtml.trim(), 'utf-8');

        // 7. Guardar metadatos en el catálogo global
        const productMetadata = {
            url: url,
            nombre: productName,
            categoria: category,
            subcategoria: subcategory,
            imagen: `categorias/${safeCat}/${safeSubCat}/${safeProd}/imagen.webp`,
            descripcion: `categorias/${safeCat}/${safeSubCat}/${safeProd}/descripcion.html`
        };
        catalogoGlobal.push(productMetadata);

        await fs.appendFile(CONFIG.progressFile, `${url}\n`);
        successCount++;
        bar.increment(1, { status: `OK: ${productName.substring(0, 15)}` });
      } catch (error) {
        await fs.appendFile(CONFIG.errorsFile, `[${url}] ${error.message}\n`);
        errorCount++;
        bar.increment(1, { status: `ERR: ${error.message.substring(0, 15)}` });
      }
    })
  );

  await Promise.all(tasks);
  bar.stop();

  // Guardar archivo JSON con todo
  await fs.writeFile(CONFIG.jsonFile, JSON.stringify(catalogoGlobal, null, 2), 'utf-8');

  console.log('\n══════════════════════════════════════════════════');
  console.log('📊  Resumen final:');
  console.log(`    ✅  Estructurados   : ${successCount}`);
  console.log(`    ❌  Errores         : ${errorCount}`);
  console.log(`    📁  Directorio Base : ${CONFIG.outputDir}`);
  console.log(`    🗄️   JSON Maestro    : ${CONFIG.jsonFile}`);
  console.log('══════════════════════════════════════════════════');
  console.log('\n✅  Proceso completado.\n');
}

main().catch((err) => {
  console.error('\n❌ Error inesperado:', err);
  process.exit(1);
});
