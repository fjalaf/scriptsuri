import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import { USER_AGENT } from './config.js';

const client = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': USER_AGENT },
  responseType: 'arraybuffer',
});

const slug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Un SPA suele responder 200 con index.html para rutas inexistentes, así que
// se valida que lo descargado sea realmente una imagen (bytes mágicos).
function esImagen(buffer) {
  const jpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpg || png || webp;
}

/**
 * Descarga la imagen de cada variedad a imagenes/<producto>/<archivo> y
 * agrega `imagen_local` (relativo a la carpeta de salida) a cada variedad.
 */
export async function descargarImagenes(productos, imagenesDir) {
  for (const producto of productos) {
    const carpeta = slug(producto.producto);
    await fs.mkdir(path.join(imagenesDir, carpeta), { recursive: true });

    for (const variedad of producto.variedades) {
      const archivo = path.basename(new URL(variedad.imagen_url).pathname);
      process.stdout.write(`  ↓ ${carpeta}/${archivo} ... `);
      try {
        const { data } = await client.get(variedad.imagen_url);
        const buffer = Buffer.from(data);
        if (!esImagen(buffer)) throw new Error('la respuesta no es una imagen');

        await fs.writeFile(path.join(imagenesDir, carpeta, archivo), buffer);
        variedad.imagen_local = `imagenes/${carpeta}/${archivo}`;
        console.log(`OK (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (error) {
        variedad.imagen_local = null;
        console.log(`FALLÓ — ${error.message}`);
      }
    }
  }
}
