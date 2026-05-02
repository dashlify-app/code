// Tipos para manejo de datasets (archivos y Google Sheets)

export type SourceType = 'upload' | 'google-sheets';

export interface RawSchema {
  headers: string[];
  sampleData: Record<string, any>[];
  rowCount: number;
}

export interface DatasetBaseInfo {
  id: string;
  name: string;
  userId?: string;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedDataset extends DatasetBaseInfo {
  sourceType: 'upload';
  rawSchema: RawSchema;
}

export interface GoogleSheetsDataset extends DatasetBaseInfo {
  sourceType: 'google-sheets';
  sourceUrl: string;
  sheetId: string;
  sheetTab?: string;
  isAutoRefresh: boolean;
  refreshInterval?: number; // en minutos, null = solo manual
  lastRefreshedAt?: string;
  rawSchema: RawSchema; // Los datos actuales
}

export type Dataset = UploadedDataset | GoogleSheetsDataset;

// Helper para verificar si es Google Sheets
export function isGoogleSheetsDataset(dataset: Dataset): dataset is GoogleSheetsDataset {
  return dataset.sourceType === 'google-sheets';
}

// Helper para verificar si es upload
export function isUploadedDataset(dataset: Dataset): dataset is UploadedDataset {
  return dataset.sourceType === 'upload';
}

// Información para importación de Google Sheets (antes de crear el dataset completo)
export interface ImportedSheet {
  id: string;
  name: string;
  data: Record<string, any>[];
  headers: string[];
  sourceUrl: string;
  refreshInterval?: number;
  isAutoRefresh: boolean;
}

// Info para refresh de datos
export interface RefreshDatasetRequest {
  datasetId: string;
  accessToken: string;
  sheetId: string;
  sheetTab?: string;
}

export interface RefreshDatasetResponse {
  data: Record<string, any>[];
  headers: string[];
  lastRefreshedAt: string;
}
