import axios from 'axios';
import { createWriteStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { generateSeoSlug, extractExtension } from '../utils/helpers.js';

/**
 * Descarga una única imagen y la guarda en disco.
 * 
 * @param {string} url - URL de la imagen a descargar.
 * @param {string} destPath - Ruta completa donde se guardará el archivo.
 * @returns {Promise<void>}
 */
async function downloadImage(url, destPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: config.requestTimeoutMs,
      headers: config.headers,
    });

    return new Promise((resolve, reject) => {
      const writer = createWriteStream(destPath);
      response.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve();
      });
    });
  } catch (error) {
    logger.error(`Error descargando imagen: ${url} - ${error.message}`);
    throw error;
  }
}

/**
 * Procesa todas las imágenes de una propiedad.
 * Crea el directorio SEO, descarga las imágenes de forma secuencial
 * para no sobresaturar, y devuelve un array con las rutas locales.
 * 
 * @param {object} property - El objeto propiedad.
 * @param {string} outputBaseDir - Directorio base (ej. 'output').
 * @returns {Promise<string[]>} - Array de rutas locales relativas.
 */
export async function processPropertyImages(property, outputBaseDir) {
  if (!property.imagenes || property.imagenes.length === 0) {
    return [];
  }

  // Generar el slug SEO basado en el título, o un identificador de fallback
  const fallbackTitle = property.id ? `propiedad-${property.id}` : 'propiedad';
  const slug = generateSeoSlug(property.titulo || fallbackTitle);
  
  // Crear el directorio de la propiedad: output/slug/
  const propertyDir = path.join(process.cwd(), outputBaseDir, slug);
  await mkdir(propertyDir, { recursive: true });

  // Guardar la información de la propiedad en un archivo .txt
  const txtPath = path.join(propertyDir, 'propiedad.txt');
  await writeFile(txtPath, JSON.stringify(property, null, 2), 'utf-8');

  const imagenesLocales = [];

  // Descargamos secuencialmente las imágenes de esta propiedad
  // (La concurrencia global se maneja por propiedad en scraperService)
  for (let i = 0; i < property.imagenes.length; i++) {
    const url = property.imagenes[i];
    const ext = extractExtension(url);
    const fileName = `${slug}-foto-${i + 1}${ext}`;
    const destPath = path.join(propertyDir, fileName);

    try {
      await downloadImage(url, destPath);
      // Guardar ruta relativa en formato POSIX para el JSON
      const relativePath = `${slug}/${fileName}`;
      imagenesLocales.push(relativePath);
    } catch (error) {
      // Si falla una foto, simplemente la omitimos y seguimos
      logger.warn(`No se pudo guardar la imagen ${fileName} para la propiedad ${slug}`);
    }
  }

  return imagenesLocales;
}
