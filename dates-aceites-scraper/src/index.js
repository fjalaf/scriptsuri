import fs from 'node:fs/promises';
import path from 'node:path';
import { OUTPUT_DIR, IMAGENES_DIR } from './config.js';
import { getBundle } from './fetcher.js';
import { parsearProductos } from './parser.js';
import { descargarImagenes } from './imagenes.js';

async function main() {
  console.log('Descargando catálogo de dates-aceites.com.ar ...');
  const bundle = await getBundle();
  const productos = parsearProductos(bundle);

  const totalVariedades = productos.reduce((acc, p) => acc + p.variedades.length, 0);
  console.log(`Productos: ${productos.length} — variedades: ${totalVariedades}`);

  await descargarImagenes(productos, IMAGENES_DIR);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'productos.json'), JSON.stringify(productos, null, 2));
  console.log(`Listo: ${OUTPUT_DIR}/productos.json`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
