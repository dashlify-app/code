const rows = [];
for (let i = 0; i < 5000; i++) {
  rows.push({
    "Fecha": "2026-01-05",
    "Total": Math.floor(Math.random() * 50000),
    "Región": "Norte",
    "Cantidad": 2,
    "Producto": "Laptop Pro",
    "Vendedor": "Ana López",
    "Categoría": "Electrónica",
    "Precio Unitario": 25000
  });
}
const jsonString = JSON.stringify(rows);
const bytes = Buffer.byteLength(jsonString, 'utf8');
console.log(`5000 filas ocupan: ${(bytes / 1024 / 1024).toFixed(2)} MB`);

const rows2 = [];
for (let i = 0; i < 20000; i++) {
  rows2.push({
    "Fecha": "2026-01-05",
    "Total": Math.floor(Math.random() * 50000),
    "Región": "Norte",
    "Cantidad": 2,
    "Producto": "Laptop Pro",
    "Vendedor": "Ana López",
    "Categoría": "Electrónica",
    "Precio Unitario": 25000
  });
}
const jsonString2 = JSON.stringify(rows2);
const bytes2 = Buffer.byteLength(jsonString2, 'utf8');
console.log(`20000 filas ocupan: ${(bytes2 / 1024 / 1024).toFixed(2)} MB`);
