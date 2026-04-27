/** Tipos para análisis cruzado multi-dataset */

export interface ColumnStat {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'unknown';
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  top5?: { value: string; count: number }[];
}

export interface DatasetForAnalysis {
  id: string;
  name: string; // "ventas.csv"
  headers: string[];
  sampleData: Record<string, any>[]; // 5 primeras + 5 random = 10 filas
  columnStats: ColumnStat[];
}

export interface MultiDatasetAnalysisRequest {
  datasets: DatasetForAnalysis[];
}

export interface RelationshipDetected {
  from: string; // nombre dataset
  to: string; // nombre dataset
  keys: { [fromKey: string]: string }; // { ventas.customer_id: clientes.id }
  relationship: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  confidence: number; // 0-1
}

export interface ProposedWidget {
  title: string;
  description?: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'stat' | 'area' | 'donut';
  category?: string; // "📊 Análisis Ejecutivo"
  priority: number; // 1-10, higher = más importante

  // Configuración para IA (qué hacer)
  datasetConfig: {
    primary: string; // "ventas.csv"
    joins?: JoinConfig[];
    calculations?: Calculation[];
  };

  // Configuración para motor local (cómo renderizar)
  config: {
    xAxis: string;
    yAxis?: string | string[];
    aggregate?: 'sum' | 'avg' | 'median' | 'count' | 'mom' | 'cumulative' | 'outliers';
    colorColumn?: string;
    sizeColumn?: string;
  };
}

export interface MultiDatasetAnalysis {
  domain: string; // "Retail", "Finanzas", "RRHH"
  narrative: string; // Resumen ejecutivo
  datasets: {
    name: string;
    role: 'transactions' | 'dimension' | 'fact' | 'other';
    recordCount: number;
    columnCount: number;
  }[];
  relationships: RelationshipDetected[];
  mainKPIs: string[];
  proposedWidgets: ProposedWidget[];
  followUpQuestion?: string;
}

export interface JoinConfig {
  dataset: string; // "clientes.csv"
  type?: 'left' | 'inner' | 'full'; // default: 'left'
  on: { [primaryKey: string]: string }; // { "ventas.customer_id": "clientes.id" }
  selectColumns: string[]; // qué columnas traer
}

export interface Calculation {
  name: string; // "revenue"
  column: string; // columna a agreguar
  aggregate: 'sum' | 'avg' | 'median' | 'count' | 'min' | 'max' | 'count_distinct';
  groupBy?: string; // si necesita agrupar por otra columna
  formula?: string; // descripción legible
}

// Config guardado en Widget.dataSourceConfig cuando tiene múltiples datasets
export interface MultiDatasetWidgetConfig {
  primary: string; // "ventas.csv"
  joins?: JoinConfig[];
  calculations?: Calculation[];
}

// Resultado del procesamiento local (lo que devuelve multiDatasetJoin)
export interface JoinedProcessedData {
  labels: string[];
  datasets: {
    label: string;
    data: (number | { x: number; y: number })[];
  }[];
  metadata?: {
    joinedFrom: string[];
    calculationsApplied: string[];
  };
}
