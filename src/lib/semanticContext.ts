/**
 * Asigna un rol a columnas reales a partir de encabezados (ES/EN, variantes comunes).
 */

export const VIEW_KEYS = [
  'business',
  'financial',
  'inventory',
  'suppliers',
  'quality',
  'temporal',
] as const;
export type SemanticViewKey = (typeof VIEW_KEYS)[number];

export function normalizeViewParam(v: string | null | undefined): SemanticViewKey {
  const raw = (v || 'business').toLowerCase();
  const legacy: Record<string, SemanticViewKey> = {
    auto: 'business',
    executive: 'business',
    trends: 'temporal',
    distribution: 'business',
    comparison: 'business',
  };
  if (raw in legacy) return legacy[raw]!;
  if (VIEW_KEYS.includes(raw as SemanticViewKey)) return raw as SemanticViewKey;
  return 'business';
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

function findHeader(headers: string[], test: (n: string, original: string) => boolean): string | null {
  for (const h of headers) {
    const n = norm(h);
    if (test(n, h)) return h;
  }
  return null;
}

export type SemanticContext = {
  /** Columnas mapeadas (nombre de columna real o null) */
  category: string | null;
  family: string | null;
  subfamily: string | null;
  productName: string | null;
  price: string | null;
  cost: string | null;
  stock: string | null;
  minStock: string | null;
  brand: string | null;
  supplier: string | null;
  country: string | null;
  leadDays: string | null;
  warehouse: string | null;
  rating: string | null;
  reviews: string | null;
  dateField: string | null;
  /** Todos los date por tipo duro */
  dateColumns: string[];
};

export function buildSemanticContext(
  headers: string[],
  rows: Record<string, any>[],
  typeDates: string[]
): SemanticContext {
  const category =
    findHeader(
      headers,
      (n) =>
        n.includes('categ') ||
        n.includes('clase') ||
        n.includes('segment') ||
        (n.includes('tipo') && n.includes('product')) ||
        n === 'grupo' ||
        (n.includes('linea') && n.includes('venta'))
    ) || null;

  const subfamily =
    findHeader(
      headers,
      (n) => n.includes('subfamil') || n.includes('subcateg') || n.includes('subfam') || n.includes('subcategor')
    ) || null;

  const family =
    findHeader(
      headers,
      (n) =>
        (n.includes('famil') && !n.includes('sub')) ||
        n === 'linea' ||
        (n.includes('linea') && !n.includes('venta'))
    ) || null;

  const productName = findHeader(
    headers,
    (n) =>
      n.includes('product') ||
      n.includes('nombre') ||
      n.includes('descrip') ||
      n.includes('articulo') ||
      n === 'item' ||
      n.includes('sku') ||
      n.includes('clave')
  );

  const price = findHeader(
    headers,
    (n) =>
      (n.includes('precio') && !n.includes('costo') && !n.includes('compra')) ||
      n.includes('pvp') ||
      n.includes('pventa') ||
      n === 'price' ||
      n.includes('sell') ||
      n.includes('venta') && n.includes('unit')
  );

  const cost = findHeader(
    headers,
    (n) =>
      n.includes('costo') ||
      n.includes('cost') && !n.includes('precio') ||
      n.includes('compra') && n.includes('unit') ||
      n.includes('cunit') ||
      n.includes('standardcost')
  );

  const stock = findHeader(
    headers,
    (n) =>
      n === 'stock' ||
      n.includes('invent') ||
      n.includes('exist') ||
      n.includes('cantidad') && !n.includes('min') ||
      n.includes('onhand') ||
      n === 'qty' ||
      n.includes('unidades') ||
      n.includes('disponib')
  );

  const minStock = findHeader(
    headers,
    (n) =>
      n.includes('stockmin') ||
      n.includes('stockminimo') ||
      n.includes('minstock') ||
      n.includes('reorden') ||
      n.includes('puntoreorden') ||
      n.includes('safety') ||
      (n.includes('min') && n.includes('stock')) ||
      n.includes('minimo')
  );

  const brand = findHeader(
    headers,
    (n) => n.includes('marca') || n.includes('brand') || n.includes('fabricant')
  );

  const supplier = findHeader(
    headers,
    (n) => n.includes('proveed') || n.includes('vendor') || n.includes('supplier')
  );

  const country = findHeader(
    headers,
    (n) => n.includes('pais') || n.includes('origen') || n.includes('country') || n.includes('paisorigen')
  );

  const leadDays = findHeader(
    headers,
    (n) =>
      n.includes('entrega') && (n.includes('dia') || n.includes('day')) ||
      n.includes('leadtime') ||
      n.includes('tiemposurt') ||
      n.includes('ltd') ||
      (n.includes('dia') && n.includes('proveed'))
  );

  const warehouse = findHeader(
    headers,
    (n) =>
      n.includes('almacen') || n.includes('bodega') || n.includes('ubic') || n.includes('warehouse') || n.includes('location')
  );

  const rating = findHeader(
    headers,
    (n) =>
      n.includes('rating') ||
      n.includes('calific') ||
      n.includes('estrella') ||
      (n.includes('star') && !n.includes('start')) ||
      n.includes('puntuac') ||
      n.includes('score') && n.includes('prod')
  );

  const reviews = findHeader(
    headers,
    (n) =>
      n.includes('rese') ||
      n.includes('review') ||
      n.includes('comentar') && n.includes('num') ||
      n.includes('numres') ||
      n.includes('nrese')
  );

  // Mejor columna de fecha: preferir "alta", "creado", "fecha" genérica
  let dateField: string | null = null;
  const fromTypes = typeDates[0] ?? null;
  const prefer = findHeader(
    headers,
    (n) =>
      n.includes('alta') ||
      n.includes('creado') ||
      n.includes('created') ||
      n.includes('fechamodif') ||
      n.includes('updated')
  );
  const generic = findHeader(
    headers,
    (n) => n.includes('fecha') || n === 'date' || n.includes('time')
  );
  dateField = prefer ?? generic ?? fromTypes;

  return {
    category,
    family: family,
    subfamily,
    productName,
    price,
    cost,
    stock,
    minStock,
    brand,
    supplier,
    country,
    leadDays,
    warehouse,
    rating,
    reviews,
    dateField,
    dateColumns: typeDates,
  };
}

export function canShowView(sem: SemanticContext, view: SemanticViewKey): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const need = (b: boolean, label: string) => {
    if (!b) missing.push(label);
  };

  switch (view) {
    case 'business':
      // Siempre disponible: resumen integral del archivo (KPIs + gráficos adaptativos / inferidos).
      break;
    case 'financial':
      need(!!(sem.price && sem.cost), 'precio y costo');
      break;
    case 'inventory':
      need(!!sem.stock, 'stock o existencias');
      break;
    case 'suppliers':
      need(!!sem.supplier, 'proveedor');
      break;
    case 'quality':
      need(!!(sem.rating || sem.reviews), 'rating o reseñas');
      break;
    case 'temporal':
      need(!!(sem.dateField || sem.dateColumns[0]), 'al menos una columna de fecha');
      break;
  }
  return { ok: missing.length === 0, missing };
}

/** Vistas mostradas en el selector: siempre «Visión general» + las que el dataset puede soportar con foco propio. */
export function getViewsForDataset(sem: SemanticContext): SemanticViewKey[] {
  return VIEW_KEYS.filter((k) => canShowView(sem, k).ok);
}
