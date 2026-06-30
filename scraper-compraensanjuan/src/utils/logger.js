// ─── Logger minimalista y sin dependencias externas ───────────────────────────
// Usa colores ANSI para distinguir niveles visualmente en la terminal.
// Agrega timestamp en cada línea para facilitar el diagnóstico.

const RESET  = '\x1b[0m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const GRAY   = '\x1b[90m';

/**
 * Devuelve la hora actual en formato HH:MM:SS.
 * @returns {string}
 */
function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

/**
 * Formatea e imprime un mensaje en consola con nivel y color.
 * @param {string} level  - Etiqueta del nivel (INFO, WARN, ERROR, etc.)
 * @param {string} color  - Código de color ANSI
 * @param {string} msg    - Mensaje a imprimir
 */
function print(level, color, msg) {
  console.log(`${GRAY}[${timestamp()}]${RESET} ${color}${level}${RESET} ${msg}`);
}

export const logger = {
  /** Información general del flujo */
  info:    (msg) => print('INFO ', CYAN,   msg),

  /** Confirmación de operaciones exitosas */
  success: (msg) => print('OK   ', GREEN,  msg),

  /** Advertencias no fatales (campo faltante, URL inesperada, etc.) */
  warn:    (msg) => print('WARN ', YELLOW, msg),

  /** Errores que no detienen el proceso */
  error:   (msg) => print('ERROR', RED,    msg),

  /** Resumen final con estadísticas */
  summary: (msg) => print('─────', CYAN,   msg),
};
