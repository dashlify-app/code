// Servicio para sincronización automática y manual de Google Sheets

import { GoogleSheetsDataset, RefreshDatasetRequest, RefreshDatasetResponse } from '@/types/dataset';

/**
 * Refrescar datos de un Google Sheets específico
 */
export async function refreshGoogleSheet(
  dataset: GoogleSheetsDataset,
  accessToken: string
): Promise<RefreshDatasetResponse> {
  if (!accessToken) {
    throw new Error('Token de acceso no disponible');
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-sheets/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fetch',
        sheetId: dataset.sheetId,
        accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al refrescar la sheet');
    }

    const result = await response.json();

    return {
      data: result.data || [],
      headers: result.headers || [],
      lastRefreshedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error refrescando Google Sheet:', error);
    throw error;
  }
}

/**
 * Validar acceso a un Google Sheets
 */
export async function validateGoogleSheet(
  sheetId: string,
  accessToken: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-sheets/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        sheetId,
        accessToken,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error validando Google Sheet:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Verificar si un dataset necesita refresh basado en tiempo
 */
export function shouldRefreshSheet(dataset: GoogleSheetsDataset): boolean {
  if (!dataset.isAutoRefresh || !dataset.refreshInterval) {
    return false;
  }

  if (!dataset.lastRefreshedAt) {
    return true;
  }

  const lastRefresh = new Date(dataset.lastRefreshedAt);
  const now = new Date();
  const minutesSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60);

  return minutesSinceRefresh >= dataset.refreshInterval;
}

/**
 * Combinar datos de múltiples sheets
 */
export function combineSheetData(
  sheets: Array<{ data: Record<string, any>[]; headers: string[] }>,
  strategy: 'merge' | 'separate'
): {
  data: Record<string, any>[];
  headers: string[];
  sourceInfo: Record<string, { rowCount: number }>;
} {
  if (strategy === 'separate') {
    // Si es separate, simplemente retornar el primero (el usuario elige cuál usar)
    const firstSheet = sheets[0];
    return {
      data: firstSheet.data,
      headers: firstSheet.headers,
      sourceInfo: {
        'primary': { rowCount: firstSheet.data.length },
      },
    };
  }

  // Estrategia merge: combinar headers y datos
  const allHeaders = new Set<string>();
  sheets.forEach((sheet) => {
    sheet.headers.forEach((h) => allHeaders.add(h));
  });

  const headers = Array.from(allHeaders);

  // Combinar datos: para cada row de cada sheet, crear un row en el resultado
  const combinedData: Record<string, any>[] = [];
  const sourceInfo: Record<string, { rowCount: number }> = {};

  sheets.forEach((sheet, idx) => {
    const sheetName = `sheet_${idx}`;
    sourceInfo[sheetName] = { rowCount: sheet.data.length };

    sheet.data.forEach((row) => {
      const combinedRow: Record<string, any> = {};
      headers.forEach((h) => {
        combinedRow[h] = row[h] || '';
      });
      combinedData.push(combinedRow);
    });
  });

  return {
    data: combinedData,
    headers,
    sourceInfo,
  };
}

/**
 * Obtener lista de Google Sheets del usuario desde Drive
 */
export async function listGoogleSheets(accessToken: string): Promise<Array<{ id: string; name: string; webViewLink: string }>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-sheets/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Error listando sheets');
    }

    const result = await response.json();
    return result.files || [];
  } catch (error) {
    console.error('Error listando Google Sheets:', error);
    throw error;
  }
}

/**
 * Calcular tiempo hasta próximo refresh
 */
export function getTimeUntilNextRefresh(dataset: GoogleSheetsDataset): { minutes: number; seconds: number } | null {
  if (!dataset.isAutoRefresh || !dataset.refreshInterval || !dataset.lastRefreshedAt) {
    return null;
  }

  const lastRefresh = new Date(dataset.lastRefreshedAt);
  const nextRefresh = new Date(lastRefresh.getTime() + dataset.refreshInterval * 60 * 1000);
  const now = new Date();
  const diffMs = nextRefresh.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { minutes: 0, seconds: 0 };
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return { minutes, seconds };
}

/**
 * Formatear tiempo desde última actualización
 */
export function formatLastRefreshTime(lastRefreshedAt: string | undefined): string {
  if (!lastRefreshedAt) {
    return 'Nunca';
  }

  const date = new Date(lastRefreshedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Hace unos segundos';
  }
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
  }
  if (diffHours < 24) {
    return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  }
  return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
}
