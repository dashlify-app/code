/**
 * Lógica compartida de análisis de datasets
 * Reutilizada por UploadZone y Google Sheets import
 */

import { computeColumnStats } from '@/lib/columnStats';

export interface DatasetForAnalysis {
  name: string;
  headers: string[];
  sampleData: any[];
  size?: string;
  type?: string;
  sourceType?: 'upload' | 'google-sheets';
  sheetId?: string;
  sourceUrl?: string;
}

/**
 * Analiza un dataset (archivo o Google Sheet) con IA
 */
export async function analyzeDataset(dataset: DatasetForAnalysis) {
  const columnStats = computeColumnStats(dataset.sampleData, dataset.headers);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      headers: dataset.headers,
      sampleData: dataset.sampleData.slice(0, 5),
      fileName: dataset.name,
      columnStats,
    }),
    headers: { 'Content-Type': 'application/json' }
  });

  const analysis = await res.json();

  if (!res.ok) {
    const msg = typeof analysis?.error === 'string' ? analysis.error : 'Error al analizar con IA';
    throw new Error(msg);
  }

  return analysis;
}

/**
 * Guarda un dataset en la base de datos
 */
export async function saveDatasetToDb(
  dataset: DatasetForAnalysis & { analysis?: any; id?: string }
) {
  const res = await fetch('/api/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dataset.name,
      sourceType: dataset.sourceType || 'upload',
      sheetId: dataset.sheetId,
      sourceUrl: dataset.sourceUrl,
      rawSchema: {
        headers: dataset.headers,
        sampleData: dataset.sampleData,
        analysis: dataset.analysis,
        fileMeta: { size: dataset.size || '', type: dataset.type || '' },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : 'Error al guardar dataset';
    throw new Error(msg);
  }

  return data?.dataset as { id: string };
}

/**
 * Procesa un dataset completo: análisis + guardar en BD
 */
export async function processDataset(dataset: DatasetForAnalysis) {
  // Analizar
  const analysis = await analyzeDataset(dataset);
  const analyzed = { ...dataset, analysis };

  // Guardar en BD
  let savedDataset: any = analyzed;
  try {
    const created = await saveDatasetToDb(analyzed);
    savedDataset = { ...analyzed, id: created.id };
  } catch (e) {
    // Si falla la BD, generar ID en cliente y mantener análisis en UI
    console.error('Error guardando dataset:', e);
    savedDataset = { ...analyzed, id: crypto.randomUUID() };
  }

  return savedDataset;
}
