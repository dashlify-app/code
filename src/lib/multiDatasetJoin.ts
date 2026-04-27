/**
 * Motor de joins local - Procesa datos cruzados sin dependencia de IA
 * Soporta LEFT JOIN, INNER JOIN, GROUP BY y múltiples agregaciones
 */

import { JoinConfig, Calculation, JoinedProcessedData } from './types/multiDataset';

interface JoinedRow {
  [key: string]: any;
}

/**
 * Ejecuta un query con joins y agregaciones sobre datos locales
 * @param primaryDataset Dataset principal (filas)
 * @param joinConfigs Configuración de joins
 * @param calculations Qué calcular y cómo agregar
 * @param allDatasets Mapa de todos los datasets {nombre: datos}
 * @returns Datos procesados formato Chart.js
 */
export function executeJoinedQuery(
  primaryDataset: Record<string, any>[],
  joinConfigs: JoinConfig[] = [],
  calculations: Calculation[] = [],
  allDatasets: Map<string, Record<string, any>[]> = new Map()
): JoinedProcessedData {
  if (!primaryDataset || primaryDataset.length === 0) {
    return { labels: [], datasets: [] };
  }

  // 1. Ejecutar joins
  let joinedRows = primaryDataset.map(row => ({ ...row }));

  for (const joinConfig of joinConfigs) {
    const joinDataset = allDatasets.get(joinConfig.dataset);
    if (!joinDataset) {
      console.warn(`Dataset ${joinConfig.dataset} no encontrado`);
      continue;
    }

    joinedRows = performJoin(joinedRows, joinDataset, joinConfig);
  }

  if (joinedRows.length === 0) {
    return { labels: [], datasets: [] };
  }

  // 2. Si no hay cálculos explícitos, devolver los datos como están
  if (calculations.length === 0) {
    return {
      labels: [],
      datasets: [{ label: 'Data', data: [] }],
      metadata: {
        joinedFrom: joinConfigs.map(c => c.dataset),
        calculationsApplied: []
      }
    };
  }

  // 3. Agrupar y agregar según cálculos
  const result = aggregateData(joinedRows, calculations);

  return result;
}

/**
 * Realiza un join entre dos datasets
 */
function performJoin(
  leftRows: JoinedRow[],
  rightDataset: Record<string, any>[],
  config: JoinConfig
): JoinedRow[] {
  const joinType = config.type || 'left';
  const onKeys = config.on; // { "ventas.customer_id": "clientes.id" }

  // Parsear las claves
  const leftKey = Object.keys(onKeys)[0]; // "ventas.customer_id"
  const rightKey = Object.values(onKeys)[0]; // "clientes.id"

  // Extraer nombres de columnas simples (sin prefijo)
  const leftColName = leftKey.includes('.') ? leftKey.split('.')[1] : leftKey;
  const rightColName = rightKey.includes('.') ? rightKey.split('.')[1] : rightKey;

  // Crear índice del dataset derecho para búsquedas rápidas
  const rightIndex = new Map<any, Record<string, any>[]>();
  rightDataset.forEach(row => {
    const key = row[rightColName];
    if (!rightIndex.has(key)) {
      rightIndex.set(key, []);
    }
    rightIndex.get(key)!.push(row);
  });

  const result: JoinedRow[] = [];

  for (const leftRow of leftRows) {
    const joinValue = leftRow[leftColName];
    const matchedRightRows = rightIndex.get(joinValue) || [];

    if (matchedRightRows.length > 0) {
      // Hay match - crear fila para cada match
      for (const rightRow of matchedRightRows) {
        const joined = { ...leftRow };

        // Agregar columnas seleccionadas del dataset derecho
        for (const col of config.selectColumns) {
          const colName = col.includes('.') ? col.split('.')[1] : col;
          joined[colName] = rightRow[colName];
        }

        result.push(joined);
      }
    } else if (joinType === 'left' || joinType === 'full') {
      // LEFT JOIN - incluir fila izquierda incluso sin match
      result.push(leftRow);
    }
  }

  return result;
}

/**
 * Agrupa y calcula métricas
 */
function aggregateData(rows: JoinedRow[], calculations: Calculation[]): JoinedProcessedData {
  if (rows.length === 0) {
    return { labels: [], datasets: [] };
  }

  // Detectar columna de agrupación (GROUP BY)
  const groupByCol = calculations[0]?.groupBy;

  if (!groupByCol) {
    // Sin GROUP BY - devolver un valor único
    const datasets = calculations.map(calc => ({
      label: calc.name,
      data: [calculateMetric(rows, calc)]
    }));

    return {
      labels: ['Total'],
      datasets,
      metadata: {
        joinedFrom: [],
        calculationsApplied: calculations.map(c => `${c.aggregate}(${c.column})`)
      }
    };
  }

  // Agrupar por columna
  const grouped = new Map<any, JoinedRow[]>();
  rows.forEach(row => {
    const key = row[groupByCol];
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  });

  const labels = Array.from(grouped.keys()).map(k => String(k)).slice(0, 15); // máx 15 grupos

  const datasets = calculations.map(calc => ({
    label: calc.name,
    data: labels.map(label => {
      const groupRows = grouped.get(
        // Buscar la clave original que corresponde a este label
        Array.from(grouped.keys()).find(k => String(k) === label)
      ) || [];
      return calculateMetric(groupRows, calc);
    })
  }));

  return {
    labels,
    datasets,
    metadata: {
      joinedFrom: [],
      calculationsApplied: calculations.map(c => `${c.aggregate}(${c.column})`)
    }
  };
}

/**
 * Calcula una métrica sobre un conjunto de filas
 */
function calculateMetric(rows: JoinedRow[], calc: Calculation): number {
  if (rows.length === 0) return 0;

  const values = rows
    .map(row => {
      const val = row[calc.column];
      const num = parseFloat(String(val ?? 0).replace(/[$,\s%]/g, ''));
      return isNaN(num) ? 0 : num;
    })
    .filter(v => !isNaN(v));

  switch (calc.aggregate) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);

    case 'avg':
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    case 'count':
      return rows.length;

    case 'count_distinct': {
      const distinct = new Set(values);
      return distinct.size;
    }

    case 'median': {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    case 'min':
      return Math.min(...values, 0);

    case 'max':
      return Math.max(...values, 0);

    default:
      return values.reduce((a, b) => a + b, 0); // default sum
  }
}

/**
 * Helper: Valida que los joins sean posibles
 */
export function validateJoins(
  primaryDataset: Record<string, any>[],
  joinConfigs: JoinConfig[],
  allDatasets: Map<string, Record<string, any>[]>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const joinConfig of joinConfigs) {
    if (!allDatasets.has(joinConfig.dataset)) {
      errors.push(`Dataset ${joinConfig.dataset} no encontrado`);
      continue;
    }

    // Verificar que las claves existan
    const leftKey = Object.keys(joinConfig.on)[0];
    const rightKey = Object.values(joinConfig.on)[0];

    const leftColName = leftKey.includes('.') ? leftKey.split('.')[1] : leftKey;
    const rightColName = rightKey.includes('.') ? rightKey.split('.')[1] : rightKey;

    const hasLeftCol = primaryDataset.some(row => leftColName in row);
    const rightDataset = allDatasets.get(joinConfig.dataset)!;
    const hasRightCol = rightDataset.some(row => rightColName in row);

    if (!hasLeftCol) {
      errors.push(`Columna ${leftColName} no encontrada en dataset principal`);
    }

    if (!hasRightCol) {
      errors.push(`Columna ${rightColName} no encontrada en ${joinConfig.dataset}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
