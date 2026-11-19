import { BASE_URL } from './config.js';

// En el bundle minificado el catálogo tiene la forma:
//   {name:"Aceitunas Verdes",desc:"...",variants:[{label:"330g",img:"/products/verdes-330g.jpg"},...]}
const RE_PRODUCTO = /\{name:"([^"]+)",desc:"(?:[^"\\]|\\.)*",variants:\[(.*?)\]\}/g;
const RE_VARIANTE = /\{label:"([^"]+)",img:"([^"]+)"\}/g;

/**
 * Extrae del bundle los productos con sus variedades (nombre + imagen).
 * @param {string} bundle
 * @returns {Array<{producto: string, variedades: Array<{variedad: string, imagen_url: string}>}>}
 */
export function parsearProductos(bundle) {
  const productos = [];

  for (const [, nombre, variantesRaw] of bundle.matchAll(RE_PRODUCTO)) {
    const variedades = [...variantesRaw.matchAll(RE_VARIANTE)].map(([, variedad, img]) => ({
      variedad,
      imagen_url: new URL(img, BASE_URL).href,
    }));

    if (variedades.length === 0) {
      throw new Error(`El producto "${nombre}" no tiene variedades parseables`);
    }
    productos.push({ producto: nombre, variedades });
  }

  if (productos.length === 0) {
    throw new Error('No se encontró el catálogo en el bundle (¿cambió la estructura del sitio?)');
  }
  return productos;
}
