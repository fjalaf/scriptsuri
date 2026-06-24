/**
 * renombrar-archivos.js
 * Renombra imagen.webp y descripcion.html para que coincidan con el nombre
 * del producto (formato SEO/WebP), y actualiza catalogo.json.
 */

import fs from 'fs';
import path from 'path';

const catalogoPath = path.join(process.cwd(), 'catalogo-estructurado', 'catalogo.json');
const baseDir = path.join(process.cwd(), 'catalogo-estructurado');

function getWebpFileName(productName) {
  return productName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .replace(/^_|_$/g, '');
}

function main() {
  console.log('Iniciando renombramiento SEO de archivos...');
  
  if (!fs.existsSync(catalogoPath)) {
    console.error('No se encontró catalogo.json');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(catalogoPath, 'utf-8'));
  let renamedCount = 0;

  data.forEach((product) => {
    const newName = getWebpFileName(product.nombre);
    
    // Rutas absolutas a los archivos viejos
    const oldImgPathAbs = path.join(baseDir, product.imagen);
    const oldDescPathAbs = path.join(baseDir, product.descripcion);
    
    // Nuevas rutas relativas
    const dirRelative = path.dirname(product.imagen);
    const newImgRel = path.posix.join(dirRelative, `${newName}.webp`);
    const newDescRel = path.posix.join(dirRelative, `${newName}.html`);

    // Rutas absolutas nuevas
    const newImgPathAbs = path.join(baseDir, newImgRel);
    const newDescPathAbs = path.join(baseDir, newDescRel);

    // Renombrar imagen si existe
    if (fs.existsSync(oldImgPathAbs) && oldImgPathAbs !== newImgPathAbs) {
      fs.renameSync(oldImgPathAbs, newImgPathAbs);
    }
    
    // Renombrar descripción si existe
    if (fs.existsSync(oldDescPathAbs) && oldDescPathAbs !== newDescPathAbs) {
      fs.renameSync(oldDescPathAbs, newDescPathAbs);
    }

    // Actualizar JSON
    product.imagen = newImgRel;
    product.descripcion = newDescRel;
    renamedCount++;
  });

  fs.writeFileSync(catalogoPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`¡Renombramiento completado! Se actualizaron ${renamedCount} entradas en el catálogo.`);
}

main();
