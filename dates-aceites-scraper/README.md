# dates-aceites-scraper

Extrae los productos de [dates-aceites.com.ar](https://dates-aceites.com.ar/#productos):
nombre e imagen de cada variedad (presentación). No guarda nada más del sitio.

El sitio es una SPA (Vite/React) y el catálogo está embebido en el bundle JS
(`/assets/index-*.js`), así que no hace falta un navegador headless: se lee el
bundle desde el `index.html` y se parsea.

## Uso

```bash
npm install
npm start
```

## Salida

```
output/
├── productos.json            # producto -> variedades (nombre, imagen_url, imagen_local)
└── imagenes/
    └── <producto>/<archivo>.jpg
```
