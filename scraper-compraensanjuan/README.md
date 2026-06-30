# Scraper – Compra en San Juan / Inmobiliaria Staff

Scraper profesional, modular y escalable para extraer propiedades de [compraensanjuan.com](https://www.compraensanjuan.com).

---

## Tecnologías

| Paquete | Rol |
|---|---|
| `axios` | Cliente HTTP |
| `cheerio` | Parser HTML |
| `dotenv` | Variables de entorno |
| `p-limit` | Control de concurrencia |
| `fs/promises` | Escritura del JSON de salida |

---

## Estructura del proyecto

```
scraper-compraensanjuan/
├── src/
│   ├── index.js                 ← Punto de entrada
│   ├── config/
│   │   └── config.js            ← Configuración central (lee .env)
│   ├── scraper/
│   │   ├── fetcher.js           ← Cliente HTTP (Axios)
│   │   ├── listings.js          ← Paginación + URLs del listado
│   │   ├── property.js          ← Scraping individual de una propiedad
│   │   └── parser.js            ← Transformación HTML → objeto JS
│   ├── services/
│   │   ├── scraperService.js    ← Orquestador del flujo completo
│   │   └── storageService.js    ← Persistencia en disco
│   └── utils/
│       ├── logger.js            ← Logger con colores ANSI
│       ├── helpers.js           ← Funciones puras reutilizables
│       └── validators.js        ← Validaciones de entrada
├── output/
│   └── properties.json          ← Generado al ejecutar
├── .env                         ← Variables de configuración
├── .gitignore
└── package.json
```

---

## Instalación

```bash
cd scraper-compraensanjuan
npm install
```

## Uso

```bash
npm start
```

### Salida esperada en consola

```
[10:00:00] INFO  Iniciando extracción del listado de propiedades...
[10:00:01] INFO  GET https://www.compraensanjuan.com/.../1
[10:00:02] INFO  Páginas detectadas en el listado: 3
[10:00:04] OK    Procesada: Casa en Venta – Rivadavia
...
[10:00:45] ─────           RESUMEN FINAL
[10:00:45] ─────  Propiedades encontradas:    48
[10:00:45] ─────  Procesadas correctamente:   46
[10:00:45] ─────  Con errores:                2
[10:00:45] ─────  Tiempo total:               44.3 segundos
```

### Archivo de salida

`output/properties.json` — array de objetos con esta estructura:

```json
{
  "id": "12345",
  "titulo": "Casa en Venta – Rivadavia",
  "subtitulo": null,
  "tipoOperacion": "Venta",
  "categoria": "Casa",
  "precio": "120000",
  "moneda": "USD",
  "ubicacion": "Rivadavia, San Juan",
  "direccion": null,
  "descripcion": "Hermosa casa de 3 dormitorios...",
  "dormitorios": 3,
  "baños": 2,
  "cocheras": 1,
  "superficieTotal": 200,
  "superficieCubierta": 120,
  "antiguedad": null,
  "estado": null,
  "caracteristicas": ["Pileta", "Jardín"],
  "nombreInmobiliaria": "Inmobiliaria Staff",
  "telefono": "+54 264 XXX-XXXX",
  "email": null,
  "url": "https://www.compraensanjuan.com/...",
  "fechaPublicacion": null,
  "imagenes": ["https://...jpg"]
}
```

---

## Configuración (.env)

| Variable | Descripción | Default |
|---|---|---|
| `BASE_URL` | URL base del sitio | `https://www.compraensanjuan.com` |
| `LISTING_URL` | URL del listado sin número de página | *(ver .env)* |
| `CONCURRENCY` | Requests simultáneos | `3` |
| `REQUEST_DELAY_MS` | Pausa entre requests (ms) | `500` |
| `REQUEST_TIMEOUT_MS` | Timeout por request (ms) | `15000` |
| `OUTPUT_DIR` | Carpeta de salida | `output` |
| `OUTPUT_FILE` | Nombre del archivo | `properties.json` |

---

## Extender a otras inmobiliarias

1. Copiar `src/scraper/parser.js` y ajustar los **selectores CSS**.
2. Actualizar `LISTING_URL` en `.env`.
3. Ejecutar.

El resto del código (fetcher, listings, services, utils) **no requiere cambios**.
