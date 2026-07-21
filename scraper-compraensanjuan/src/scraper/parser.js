import * as cheerio from 'cheerio';
import { cleanText, parseIntOrNull, parseFloatOrNull, extractPriceAndCurrency, buildAbsoluteUrl } from '../utils/helpers.js';
import { config } from '../config/config.js';

// ─── Parser de propiedades ─────────────────────────────────────────────────────
// Responsabilidad: transformar el HTML de una propiedad en un objeto JS
// normalizado y consistente.
//
// IMPORTANTE: Los selectores de Cheerio están documentados con notas sobre
// dónde buscan en el HTML. Se ajustarán tras inspección del HTML real del sitio.
// Nunca se asume que un campo existe; todo devuelve null si no se encuentra.

/**
 * Plantilla del objeto propiedad con todos los campos posibles.
 * Garantiza que el JSON de salida siempre tenga estructura consistente.
 *
 * @returns {object} - Propiedad con todos los campos en null/[]
 */
function createEmptyProperty() {
  return {
    id:               null,
    titulo:           null,
    subtitulo:        null,
    tipoOperacion:    null,
    tipoPropiedad:    null,
    categoria:        null,
    precio:           null,
    moneda:           null,
    ubicacion:        null,
    direccion:        null,
    departamento:     null,
    barrio:           null,
    numero:           null,
    calle:            null,
    descripcion:      null,
    dormitorios:      null,
    ambientes:        null,
    baños:            null,
    cocheras:         null,
    plantas:          null,
    superficieTotal:  null,
    superficieCubierta: null,
    antiguedad:       null,
    orientacion:      null,
    aptoCredito:      null,
    expensas:         null,
    estado:           null,
    caracteristicas:  [],
    nombreInmobiliaria: null,
    telefono:         null,
    email:            null,
    url:              null,
    fechaPublicacion: null,
    imagenes:         [],
  };
}

/**
 * Extrae el ID de la propiedad desde la URL.
 * Patrón esperado: /tienda-virtual/anuncio/{id}/...
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/anuncio(?:_[a-z]+)?\/(\d+)\//);
  return match ? match[1] : null;
}

/**
 * Extrae el título principal de la propiedad.
 * Busca en los encabezados h1/h2 de la página de detalle.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractTitulo($) {
  const text = cleanText($('.anuncio-title, h1.titulo-anuncio, h1').first().text());
  return text || null;
}

/**
 * Extrae el subtítulo o descripción corta.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractSubtitulo($) {
  const candidates = [
    'h2.subtitulo',
    'h2[class*="subtitulo"]',
    '.subtitulo-anuncio',
    'h2',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }
  return null;
}

/**
 * Extrae el precio y la moneda del anuncio.
 *
 * @param {object} $
 * @returns {{ precio: string|null, moneda: string|null }}
 */
function extractPrecio($) {
  const candidates = [
    '.precio-anuncio',
    '.precio',
    '[class*="precio"]',
    '[class*="price"]',
  ];

  for (const selector of candidates) {
    const raw = cleanText($(selector).first().text());
    if (raw) return extractPriceAndCurrency(raw);
  }
  return { precio: null, moneda: null };
}

/**
 * Extrae la descripción larga de la propiedad.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractDescripcion($) {
  const candidates = [
    '.descripcion-anuncio',
    '.texto-anuncio',
    '[class*="descripcion"]',
    'meta[name="DESCRIPTION"]',
  ];

  for (const selector of candidates) {
    const el = $(selector).first();
    const text = cleanText(selector.includes('meta') ? el.attr('content') : el.text());
    if (text && text.length > 20) return text;
  }
  return null;
}

/**
 * Extrae la ubicación (ciudad, barrio) de la propiedad.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractUbicacion($) {
  const candidates = [
    '[class*="ubicacion"]',
    '[class*="location"]',
    '[class*="localidad"]',
    '[class*="zona"]',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) {
      return text.replace(/^ubicaci[oó]n:\s*/i, '').trim() || text;
    }
  }
  return null;
}

/**
 * Extrae los datos detallados de ubicación desde la tabla de características.
 *
 * @param {object} $
 * @returns {object}
 */
function extractDatosUbicacion($) {
  const result = {
    calle: null,
    numero: null,
    barrio: null,
    departamento: null,
  };
  $('.name-caracteristica').each((_, el) => {
    const label = cleanText($(el).contents().filter(function() { return this.nodeType === 3; }).text()) ?? '';
    const valueText = cleanText($(el).find('.caracteristica').text()) ?? '';
    const lower = label.toLowerCase().replace(':', '');
    
    if (lower === 'calle') result.calle = valueText;
    else if (lower === 'número' || lower === 'numero') result.numero = valueText;
    else if (lower === 'barrio') result.barrio = valueText;
    else if (lower === 'departamento') result.departamento = valueText;
  });
  return result;
}

/**
 * Extrae la dirección exacta si está disponible (fallback para cuando no hay características detalladas).
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractDireccionFallback($) {

  const candidates = [
    '[class*="direccion"]',
    '[class*="address"]',
    '[class*="calle"]',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }
  return null;
}

/**
 * Extrae las características técnicas de la propiedad
 * (dormitorios, baños, cocheras, superficie).
 * Busca en tablas de atributos o listas de características.
 *
 * @param {object} $
 * @returns {object} - Campos técnicos extraídos
 */
function extractCaracteristicasTecnicas($) {
  const result = {
    dormitorios:       null,
    ambientes:         null,
    baños:             null,
    cocheras:          null,
    plantas:           null,
    superficieTotal:   null,
    superficieCubierta: null,
    antiguedad:        null,
    orientacion:       null,
    aptoCredito:       null,
    expensas:          null,
    estado:            null,
  };

  const fieldMap = [
    { patterns: ['dormitorio', 'habitacion'], field: 'dormitorios', parser: parseIntOrNull },
    { patterns: ['ambiente'],                             field: 'ambientes',   parser: parseIntOrNull },
    { patterns: ['baño', 'bano', 'sanitario'],            field: 'baños',       parser: parseIntOrNull },
    { patterns: ['cochera', 'garage'],                    field: 'cocheras',    parser: parseIntOrNull },
    { patterns: ['planta', 'piso'],                       field: 'plantas',     parser: parseIntOrNull },
    { patterns: ['sup.*total'],                           field: 'superficieTotal', parser: parseFloatOrNull },
    { patterns: ['sup.*cubierta'],                        field: 'superficieCubierta', parser: parseFloatOrNull },
    { patterns: ['antigüedad', 'antiguedad', 'año'],      field: 'antiguedad',  parser: cleanText },
    { patterns: ['orientaci.n', 'orientacion'],           field: 'orientacion', parser: cleanText },
    { patterns: ['apto cr.dito', 'apto credito'],         field: 'aptoCredito', parser: cleanText },
    { patterns: ['expensa'],                              field: 'expensas',    parser: parseIntOrNull },
    { patterns: ['estado', 'condicion'],                  field: 'estado',      parser: cleanText },
  ];

  $('.name-caracteristica').each((_, el) => {
    // Obtenemos solo el texto del nodo actual (el nombre de la etiqueta) y no el span hijo
    const label = cleanText($(el).contents().filter(function() { return this.nodeType === 3; }).text()) ?? '';
    const valueText = cleanText($(el).find('.caracteristica').text()) ?? '';
    const lower = label.toLowerCase();

    for (const { patterns, field, parser } of fieldMap) {
      if (result[field] !== null && result[field] !== 'Sin especificar') continue;
      const matches = patterns.some((p) => new RegExp(p, 'i').test(lower));
      if (matches) {
        result[field] = parser(valueText);
      }
    }
  });

  return result;
}

/**
 * Extrae el array de características adicionales de la propiedad.
 *
 * @param {object} $
 * @returns {string[]}
 */
function extractCaracteristicasArray($) {
  const items = [];
  const candidates = [
    '.caracteristicas li',
    '[class*="caracteristica"] li',
    '[class*="amenitie"]',
    '[class*="feature"]',
  ];

  for (const selector of candidates) {
    $(selector).each((_, el) => {
      const text = cleanText($(el).text());
      if (text && !items.includes(text)) items.push(text);
    });
    if (items.length > 0) break;
  }

  return items;
}

/**
 * Extrae el tipo de operación (Venta, Alquiler, etc.).
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractTipoOperacion($) {
  const candidates = [
    '[class*="tipo-operacion"]',
    '[class*="operacion"]',
    '[class*="operation"]',
    'meta[property*="tipo"]',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }

  // Fallback: buscar en el título o breadcrumb
  const titulo = extractTitulo($)?.toLowerCase() ?? '';
  if (titulo.includes('venta')) return 'Venta';
  if (titulo.includes('alquiler')) return 'Alquiler';
  if (titulo.includes('permuta')) return 'Permuta';

  return null;
}

/**
 * Extrae la categoría o tipo de propiedad (Casa, Departamento, Terreno, etc.).
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractCategoria($) {
  const candidates = [
    '[class*="categoria"]',
    '[class*="category"]',
    '[class*="tipo-propiedad"]',
    '[class*="tipo_propiedad"]',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }
  return null;
}

/**
 * Determina el tipo de propiedad basándose en la categoría, título y descripción.
 *
 * @param {string|null} categoria
 * @param {string|null} titulo
 * @param {string|null} descripcion
 * @returns {string|null}
 */
function extractTipoPropiedad(categoria, titulo, descripcion) {
  const combinedText = `${categoria || ''} ${titulo || ''} ${descripcion || ''}`.toUpperCase();
  
  if (combinedText.includes('DEPARTAMENTO') || combinedText.includes('MONOAMBIENTE')) return 'DEPARTAMENTO';
  if (combinedText.includes('CASA') || combinedText.includes('CABAÑA') || combinedText.includes('DUPLEX') || combinedText.includes('DÚPLEX') || combinedText.includes('CHALET')) return 'CASA';
  if (combinedText.includes('LOTE') || combinedText.includes('TERRENO') || combinedText.includes('PARCELA')) return 'LOTE';
  if (combinedText.includes('OFICINA')) return 'OFICINAS';
  if (combinedText.includes('COMERCIAL') || combinedText.includes('LOCAL') || combinedText.includes('GALPON') || combinedText.includes('GALPÓN') || combinedText.includes('FONDO DE COMERCIO')) return 'COMERCIAL';
  if (combinedText.includes('CONSULTORIO')) return 'CONSULTORIO';
  
  return null;
}

/**
 * Extrae el nombre de la inmobiliaria.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractNombreInmobiliaria($) {
  const candidates = [
    '[class*="inmobiliaria"]',
    '[class*="agencia"]',
    '[class*="empresa"]',
    '[class*="agency"]',
  ];

  for (const selector of candidates) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }
  return null;
}

/**
 * Extrae el número de teléfono de contacto.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractTelefono($) {
  const candidates = [
    '[class*="telefono"]',
    '[class*="phone"]',
    '[class*="tel"]',
    'a[href^="tel:"]',
  ];

  for (const selector of candidates) {
    const el = $(selector).first();
    // Para links tel: extraer del href
    const href = el.attr('href');
    if (href?.startsWith('tel:')) return cleanText(href.replace('tel:', ''));
    const text = cleanText(el.text());
    if (text) return text;
  }
  return null;
}

/**
 * Extrae el email de contacto.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractEmail($) {
  const candidates = [
    'a[href^="mailto:"]',
    '[class*="email"]',
    '[class*="mail"]',
  ];

  for (const selector of candidates) {
    const el = $(selector).first();
    const href = el.attr('href');
    if (href?.startsWith('mailto:')) return cleanText(href.replace('mailto:', ''));
    const text = cleanText(el.text());
    if (text && text.includes('@')) return text;
  }
  return null;
}

/**
 * Extrae la fecha de publicación del anuncio.
 *
 * @param {object} $
 * @returns {string|null}
 */
function extractFechaPublicacion($) {
  const infoText = cleanText($('.info-extra').text());
  if (infoText) {
    const match = infoText.match(/Publicado:\s*([\d/]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extrae todas las URLs de imágenes de la propiedad.
 *
 * @param {object} $
 * @returns {string[]}
 */
function extractImagenes($) {
  // Las imágenes se deshabilitaron temporalmente por pedido del usuario
  return [];
}

// ─── Función principal del parser ─────────────────────────────────────────────

/**
 * Transforma el HTML de una página de detalle en un objeto propiedad normalizado.
 * Siempre devuelve un objeto completo; los campos no encontrados quedan en null.
 *
 * @param {string} html - HTML crudo de la página de detalle
 * @param {string} url  - URL de la propiedad (usada para extraer el ID)
 * @returns {object}    - Objeto propiedad normalizado
 */
export function parseProperty(html, url) {
  const $ = cheerio.load(html);
  const property = createEmptyProperty();

  // Identificación
  property.url  = url;
  property.id   = extractIdFromUrl(url);

  // Textos principales
  property.titulo      = extractTitulo($);
  property.subtitulo   = extractSubtitulo($);
  property.descripcion = extractDescripcion($);

  // Clasificación
  property.tipoOperacion = extractTipoOperacion($);
  property.categoria     = extractCategoria($);
  property.tipoPropiedad = extractTipoPropiedad(property.categoria, property.titulo, property.descripcion);

  // Precio
  const { precio, moneda } = extractPrecio($);
  property.precio  = precio;
  property.moneda  = moneda;

  // Localización
  property.ubicacion = extractUbicacion($);
  
  const datosUbicacion = extractDatosUbicacion($);
  property.departamento = datosUbicacion.departamento;
  property.barrio = datosUbicacion.barrio;
  property.calle = datosUbicacion.calle;
  property.numero = datosUbicacion.numero;
  
  if (datosUbicacion.calle) {
    property.direccion = datosUbicacion.numero ? `${datosUbicacion.calle} ${datosUbicacion.numero}` : datosUbicacion.calle;
  } else {
    property.direccion = extractDireccionFallback($);
  }

  // Características técnicas
  const tecnicas = extractCaracteristicasTecnicas($);
  property.dormitorios        = tecnicas.dormitorios;
  property.ambientes          = tecnicas.ambientes;
  property.baños              = tecnicas.baños;
  property.cocheras           = tecnicas.cocheras;
  property.plantas            = tecnicas.plantas;
  property.superficieTotal    = tecnicas.superficieTotal;
  property.superficieCubierta = tecnicas.superficieCubierta;
  property.antiguedad         = tecnicas.antiguedad;
  property.orientacion        = tecnicas.orientacion;
  property.aptoCredito        = tecnicas.aptoCredito;
  property.expensas           = tecnicas.expensas;
  property.estado             = tecnicas.estado;

  // Lista de características adicionales
  property.caracteristicas = extractCaracteristicasArray($);

  // Contacto
  property.nombreInmobiliaria = extractNombreInmobiliaria($);
  property.telefono           = extractTelefono($);
  property.email              = extractEmail($);

  // Metadatos
  property.fechaPublicacion = extractFechaPublicacion($);
  property.imagenes         = extractImagenes($);

  return property;
}
