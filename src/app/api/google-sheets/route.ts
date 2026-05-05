import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { devLog, devVerbose } from '@/lib/logger';

const sheets = google.sheets('v4');
const drive = google.drive('v3');

// Crear cliente autenticado con token de acceso
function getAuthenticatedClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: accessToken,
  });
  return { auth, sheets: google.sheets({ version: 'v4', auth }), drive: google.drive({ version: 'v3', auth }) };
}

// Extraer ID de Google Sheets desde URL
function extractSheetIdFromUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Obtener datos de sheet público sin autenticación (usando API REST)
async function fetchSheetDataPublic(sheetId: string) {
  try {
    // Usar la API REST de Google Sheets directamente para sheets públicos
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

    devLog('🔍 [fetchSheetDataPublic] Iniciando con sheetId:', sheetId);
    devLog('🔑 [fetchSheetDataPublic] API Key presente:', !!apiKey);

    if (!apiKey) {
      throw new Error('Google API Key no configurada');
    }

    // Obtener información de la sheet (spreadsheet metadata)
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}`;
    devLog('📡 [fetchSheetDataPublic] Metadata request, sheetId:', sheetId);

    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      },
    });

    devLog('📊 [fetchSheetDataPublic] Metadata response status:', metadataResponse.status);

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('❌ [fetchSheetDataPublic] Metadata error response:', errorText);

      if (metadataResponse.status === 403) {
        // Try to parse the error details from Google
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ [fetchSheetDataPublic] Google API error details:', errorJson);
        } catch {}
        throw new Error('Forbidden');
      }
      throw new Error(`HTTP ${metadataResponse.status}`);
    }

    const spreadsheet = await metadataResponse.json();
    devLog('✅ [fetchSheetDataPublic] Spreadsheet metadata:', {
      title: spreadsheet.properties?.title,
      sheetsCount: spreadsheet.sheets?.length,
      firstSheetName: spreadsheet.sheets?.[0]?.properties?.title
    });

    if (!spreadsheet.sheets || spreadsheet.sheets.length === 0) {
      return NextResponse.json({ error: 'No se encontraron hojas en esta sheet' }, { status: 400 });
    }

    const sheetName = spreadsheet.sheets[0].properties?.title || 'Sheet1';
    const title = spreadsheet.properties?.title || 'Google Sheet';

    // Obtener datos de la hoja (valores)
    const range = `${sheetName}!A:Z`;
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    devLog('📡 [fetchSheetDataPublic] Values request, range:', range, 'sheetId:', sheetId);

    const valuesResponse = await fetch(valuesUrl, {
      headers: {
        'Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      },
    });

    devLog('📊 [fetchSheetDataPublic] Values response status:', valuesResponse.status);

    if (!valuesResponse.ok) {
      const errorText = await valuesResponse.text();
      console.error('❌ [fetchSheetDataPublic] Values error response:', errorText);
      throw new Error(`Error obteniendo valores: HTTP ${valuesResponse.status}`);
    }

    const valuesData = await valuesResponse.json();
    devLog('✅ [fetchSheetDataPublic] Values data:', {
      rowCount: valuesData.values?.length,
      firstRow: valuesData.values?.[0],
    });
    devVerbose('✅ [fetchSheetDataPublic] Values full response:', valuesData);

    const rows = valuesData.values || [];

    if (rows.length === 0) {
      devLog('⚠️ [fetchSheetDataPublic] No rows found in sheet');
      return NextResponse.json({
        data: [],
        headers: [],
        name: title,
        rowCount: 0,
        isPublic: true,
      });
    }

    // Primera fila son los headers
    const headers = rows[0] || [];
    const data = rows.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((header: any, idx: number) => {
        obj[header] = row[idx] || '';
      });
      return obj;
    });

    devLog('✅ [fetchSheetDataPublic] Successfully processed:', {
      headersCount: headers.length,
      rowsCount: data.length,
      headers: headers
    });

    return NextResponse.json({
      data,
      headers,
      name: title,
      rowCount: data.length,
      isPublic: true,
    });
  } catch (error: any) {
    console.error('❌ [fetchSheetDataPublic] Error:', error.message);
    console.error('❌ [fetchSheetDataPublic] Full error:', error);
    throw error;
  }
}

// POST /api/google-sheets/fetch - Obtener datos de una sheet
export async function POST(request: Request) {
  try {
    const { action, sheetId, accessToken, url } = await request.json();

    // Si action es fetch o no se especifica, obtener datos
    if (!action || action === 'fetch') {
      if (!sheetId && !url) {
        return NextResponse.json({ error: 'Se requiere sheetId o URL' }, { status: 400 });
      }

      const id = sheetId || extractSheetIdFromUrl(url || '');
      if (!id) {
        return NextResponse.json({ error: 'ID de sheet inválido' }, { status: 400 });
      }

      try {
        // Intentar obtener datos sin autenticación primero (para sheets públicas)
        if (!accessToken) {
          try {
            return await fetchSheetDataPublic(id);
          } catch (error: any) {
            // Si falla sin autenticación, requerir token
            if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
              return NextResponse.json(
                { error: 'Este Sheet es privado. Conecta Google para acceder.', requiresAuth: true },
                { status: 403 }
              );
            }
            throw error;
          }
        }

        const { auth, sheets: sheetsClient } = getAuthenticatedClient(accessToken);

        // Obtener información de la sheet
        const spreadsheet = await sheetsClient.spreadsheets.get({
          spreadsheetId: id,
        });

        if (!spreadsheet.data || !spreadsheet.data.sheets || spreadsheet.data.sheets.length === 0) {
          return NextResponse.json({ error: 'No se encontraron hojas en esta sheet' }, { status: 400 });
        }

        const sheetName = spreadsheet.data.sheets[0].properties?.title || 'Sheet1';
        const title = spreadsheet.data.properties?.title || 'Google Sheet';

        // Obtener datos de la hoja
        const range = `${sheetName}!A:Z`;
        const values = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: id,
          range: range,
        });

        const rows = values.data.values || [];
        if (rows.length === 0) {
          return NextResponse.json({
            data: [],
            headers: [],
            name: title,
            rowCount: 0,
          });
        }

        // Primera fila son los headers
        const headers = rows[0] || [];
        const data = rows.slice(1).map((row) => {
          const obj: Record<string, any> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] || '';
          });
          return obj;
        });

        return NextResponse.json({
          data,
          headers,
          name: title,
          rowCount: data.length,
        });
      } catch (error) {
        const err = error as any;
        console.error('Error obteniendo datos de sheet:', err);

        if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
          return NextResponse.json({ error: 'No tienes permisos para acceder a esta sheet' }, { status: 403 });
        }
        if (err.message?.includes('404') || err.message?.includes('Not found')) {
          return NextResponse.json({ error: 'Sheet no encontrada' }, { status: 404 });
        }

        return NextResponse.json(
          { error: err.message || 'Error al obtener datos de la sheet' },
          { status: 500 }
        );
      }
    }

    // Si action es validate, validar acceso
    if (action === 'validate') {
      if (!sheetId && !url) {
        return NextResponse.json({ error: 'Se requiere sheetId o URL' }, { status: 400 });
      }

      const id = sheetId || extractSheetIdFromUrl(url || '');
      if (!id) {
        return NextResponse.json({ error: 'ID de sheet inválido' }, { status: 400 });
      }

      try {
        const { sheets: sheetsClient } = getAuthenticatedClient(accessToken);

        const spreadsheet = await sheetsClient.spreadsheets.get({
          spreadsheetId: id,
        });

        return NextResponse.json({
          valid: true,
          name: spreadsheet.data.properties?.title || 'Google Sheet',
        });
      } catch (error) {
        return NextResponse.json({
          valid: false,
          error: 'No se pudo acceder a la sheet',
        });
      }
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error en API google-sheets:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
