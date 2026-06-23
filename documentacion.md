Objetivo:

Necesito descargar todas las imágenes de productos del sitio <https://www.suri-sa.com.ar>, convertirlas a formato WebP y nombrarlas utilizando el nombre del producto.

IMPORTANTE:
Antes de generar cualquier código, realiza una auditoría técnica completa del sitio y documenta tus hallazgos.

==================================================
FASE 1 - INVESTIGACIÓN
==================================================

Analiza:

<https://www.suri-sa.com.ar/>
<https://www.suri-sa.com.ar/Mapa%20del%20Sitio>

Determina:

1. Si el sitio utiliza efectivamente PrestaShop.
2. Versión aproximada de PrestaShop si puede identificarse.
3. Estructura de categorías.
4. Estructura de productos.
5. Sistema de paginación.
6. Selectores CSS de categorías.
7. Selectores CSS de productos.
8. Selectores CSS de imágenes.
9. Selectores CSS del nombre del producto.
10. Existencia de APIs públicas.
11. Existencia de endpoints JSON.
12. Existencia de feeds XML.
13. Existencia de endpoints AJAX.
14. Existencia de sitemaps XML ocultos.
15. Existencia de archivos robots.txt relevantes.
16. Existencia de endpoints de búsqueda que devuelvan productos.

Busca específicamente:

- /api
- /webservice
- /search
- /module
- endpoints AJAX
- JSON embebido
- window.prestashop
- product data en scripts

Determina cuál es la forma más eficiente de obtener:

- URL del producto
- Nombre del producto
- URL de imagen principal

Si existe una forma más eficiente que recorrer categorías HTML, documentarla y utilizarla.

==================================================
FASE 2 - VALIDACIÓN DE SELECTORES
==================================================

Analiza la página:

<https://www.suri-sa.com.ar/equipos-p-construccion/10399-revocadora-p4-para-techo-bahiense.html>

Determina exactamente:

- Selector CSS de la imagen principal.
- Selector CSS del nombre del producto.
- Selector CSS de la marca.
- Selector CSS de la categoría.
- URL real de la imagen.
- Nombre real del producto.

Explica por qué esos selectores son correctos.

==================================================
FASE 3 - EXTRACCIÓN DE CATEGORÍAS
==================================================

Analiza:

<https://www.suri-sa.com.ar/Mapa%20del%20Sitio>

Extrae todas las URLs cuyos enlaces tengan:

id^="category-page-"

Genera un script:

scripts/extraer-categorias.js

que:

- Descargue el sitemap.
- Extraiga todas las categorías.
- Elimine duplicados.
- Guarde categorias.txt.
- Muestre estadísticas.

==================================================
FASE 4 - EXTRACCIÓN DE PRODUCTOS
==================================================

Genera:

scripts/extraer-productos.js

que:

- Lea categorias.txt.
- Recorra todas las categorías.
- Detecte automáticamente la paginación.
- Recorra todas las páginas.
- Extraiga todas las URLs de productos.
- Elimine duplicados.
- Guarde productos.txt.
- Muestre progreso.

Debe soportar miles de productos.

Utilizar:

- axios
- cheerio
- p-limit
- cli-progress

==================================================
FASE 5 - DESCARGA Y CONVERSIÓN
==================================================

Genera:

scripts/descargar-imagenes.js

que:

- Lea productos.txt.
- Visite cada producto.
- Obtenga la imagen principal.
- Obtenga el nombre del producto.
- Limpie caracteres inválidos.
- Descargue la imagen.
- Convierta directamente a WebP.
- No almacene JPG temporales.
- Guarde los archivos dentro de:

imagenes-webp/

Configuración:

- Calidad WebP: 85
- Concurrencia: 10
- Timeout configurable
- Reintentos automáticos
- Manejo robusto de errores

Utilizar:

- axios
- cheerio
- sharp
- fs/promises
- p-limit

==================================================
FASE 6 - REANUDACIÓN Y LOGS
==================================================

Implementa:

procesados.txt
errores.txt

Requisitos:

- Si el archivo WebP existe, omitir.
- Si el producto ya fue procesado, omitir.
- Permitir reanudar una ejecución interrumpida.
- Registrar errores detallados.
- Registrar URLs problemáticas.

==================================================
FASE 7 - OPTIMIZACIÓN
==================================================

Optimizar para macOS Apple Silicon (M4 Pro).

Mostrar:

- Productos procesados.
- Productos restantes.
- Velocidad de procesamiento.
- Tiempo estimado restante.
- Porcentaje completado.

==================================================
FASE 8 - ESTRUCTURA FINAL
==================================================

Genera el proyecto completo:

suri-scraper/

├── categorias.txt
├── productos.txt
├── procesados.txt
├── errores.txt
├── package.json
│
├── scripts/
│   ├── extraer-categorias.js
│   ├── extraer-productos.js
│   └── descargar-imagenes.js
│
└── imagenes-webp/

==================================================
FASE 9 - PACKAGE.JSON
==================================================

Genera un package.json completo para Node.js 22+.

Dependencias:

- axios
- cheerio
- sharp
- p-limit
- cli-progress

Scripts:

- npm run extraer-categorias
- npm run extraer-productos
- npm run descargar-imagenes

==================================================
ENTREGA
==================================================

Antes de generar el código:

1. Presenta el informe técnico de investigación.
2. Justifica la estrategia elegida.
3. Explica por qué es la opción más eficiente.
4. Solo después genera el código completo listo para ejecutar.
5. No omitas archivos.
6. Entrega todos los archivos completos.
