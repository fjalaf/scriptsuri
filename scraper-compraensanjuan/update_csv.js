import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const csvPath = '../BBDD-STAFF - BBDD-GENERAL.csv';
const jsonPath = './output/properties.json';

// Read JSON
const properties = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Read CSV
const csvData = fs.readFileSync(csvPath, 'utf8');
const records = parse(csvData, { skip_empty_lines: true });

// The first 3 rows are headers
const header1 = records[0];
const header2 = records[1];
const header3 = records[2];
const dataRows = records.slice(3);

// Map columns by their name in row 3 (index 2)
const colIndex = {};
header3.forEach((col, idx) => {
    colIndex[col.trim()] = idx;
});

// Build a map of existing URLs in the CSV
const urlMap = new Map();
dataRows.forEach((row, idx) => {
    const url = row[colIndex['COMPRA EN SAN JUAN']];
    if (url) {
        urlMap.set(url.trim(), idx);
    }
});

// Helper to update a column if it exists
function updateCol(row, colName, value) {
    if (colIndex[colName] !== undefined && value !== null && value !== undefined && value !== '') {
        row[colIndex[colName]] = String(value);
    }
}

// Find the highest ID to generate new ones
let maxId = 0;
dataRows.forEach(row => {
    const id = row[colIndex['ID']];
    if (id && id.startsWith('I-')) {
        const num = parseInt(id.replace('I-', ''), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
    }
});

// Process properties
properties.forEach(prop => {
    let row;
    if (prop.url && urlMap.has(prop.url.trim())) {
        row = dataRows[urlMap.get(prop.url.trim())];
    } else {
        // Create new row
        row = new Array(header3.length).fill('');
        maxId++;
        row[colIndex['ID']] = `I-${String(maxId).padStart(4, '0')}`;
        dataRows.push(row);
    }

    // Map fields
    updateCol(row, 'COMPRA EN SAN JUAN', prop.url);
    updateCol(row, 'TIPO DE OPERACIÓN', prop.tipoOperacion?.toUpperCase());
    updateCol(row, 'TIPO DE PROPIEDAD', prop.tipoPropiedad);
    updateCol(row, 'DEPARTAMENTO', prop.departamento);
    updateCol(row, 'BARRIO', prop.barrio);
    updateCol(row, 'NÚMERO', prop.numero);
    updateCol(row, 'SUPERF. TERRENO', prop.superficieTotal);
    updateCol(row, 'SUPERF.CUB.', prop.superficieCubierta);
    updateCol(row, 'N DE PISOS', prop.plantas);
    updateCol(row, 'CANT. AMBIENTES', prop.ambientes);
    updateCol(row, 'CANT. DORMITORIOS', prop.dormitorios);
    updateCol(row, 'CANT.BANOS', prop.baños);
    updateCol(row, 'COCHERA', prop.cocheras);
    updateCol(row, 'ORIENTACION', prop.orientacion?.toUpperCase());
    updateCol(row, 'AÑO DE CONST', prop.antiguedad);
    
    // PERM/FINAN mapping from aptoCredito
    if (prop.aptoCredito === 'SI' || prop.aptoCredito === 'SÍ') {
        const currentFinan = row[colIndex['PERM/FINAN']] || '';
        if (!currentFinan.includes('CREDITO')) {
            updateCol(row, 'PERM/FINAN', currentFinan ? currentFinan + ', APTO CREDITO' : 'APTO CREDITO');
        }
    }
    
    updateCol(row, 'EXPENSAS', prop.expensas);
    updateCol(row, 'MonedaP', prop.moneda === 'USD' ? 'DOLARES' : (prop.moneda === 'ARS' ? 'PESOS' : prop.moneda));
    updateCol(row, 'PRECIO', prop.precio);
    
    // Defaults for new rows
    if (!row[colIndex['ESTADO']]) {
        updateCol(row, 'ESTADO', prop.estado || 'DISPONIBLE');
    }
    
    updateCol(row, 'FECHA PUBLICACIÓN', prop.fechaPublicacion);
});

// Output
const outputData = [header1, header2, header3, ...dataRows];
const outputCsv = stringify(outputData);

fs.writeFileSync(csvPath, outputCsv, 'utf8');
console.log(`CSV actualizado exitosamente. Filas totales de datos: ${dataRows.length}`);
