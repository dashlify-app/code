import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logAIUsage } from '@/lib/aiLogger';
import { checkRateLimit, logApiCall } from '@/lib/rateLimiter';
import type { ColumnStat } from '@/lib/columnStats';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `Eres un arquitecto de datos y analista de negocio. Recibes un archivo con columnas que pueden ser arbitrarias (idioma, nombres raros, abreviaturas). Tu tarea:
1) Inferir el dominio (retail, B2B, logística, etc.).
2) Mapear CADA ROL a UN nombre de columna EXISTE en "headers", o null si no hay dato.
3) Proponer 4 a 7 insights concretos y accionables (no genéricos).
4) Un narrativa ejecutiva (3-4 frases, español).

REGLA CRÍTICA: "columnRoles" SOLO puede contener strings que copien exactamente (carácter a carácter) un elemento de "headers", o null. Si no estás seguro, usa null.`;

function buildUserPayload(input: {
  fileName: string;
  headers: string[];
  sampleData: unknown[];
  columnStats: ColumnStat[];
}) {
  return JSON.stringify(
    {
      fileName: input.fileName,
      headers: input.headers,
      sampleRows: input.sampleData,
      columnStats: input.columnStats,
    },
    null,
    0
  );
}

const OUTPUT_SHAPE = `{
  "domain": "string (breve)",
  "narrative": "string, 3-4 frases, español, tono directivo",
  "priorityInsights": ["insight 1", "insight 2", ...],
  "columnRoles": {
    "category": "exact header or null",
    "family": null,
    "subfamily": null,
    "productName": null,
    "price": null,
    "cost": null,
    "stock": null,
    "minStock": null,
    "brand": null,
    "supplier": null,
    "country": null,
    "leadDays": null,
    "warehouse": null,
    "rating": null,
    "reviews": null,
    "dateField": null
  }
}`;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const allowed = await checkRateLimit(session.user.id, 'interpret-schema');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de llamadas excedido. Máximo 10 por minuto.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const headers: string[] = Array.isArray(body.headers) ? body.headers : [];
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'archivo';
    const sampleData = Array.isArray(body.sampleData) ? body.sampleData : [];
    const columnStats: ColumnStat[] = Array.isArray(body.columnStats) ? body.columnStats : [];

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Sin columnas' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI no configurada', code: 'NO_AI' }, { status: 503 });
    }

    const userContent = `Datos (JSON):
${buildUserPayload({ fileName, headers, sampleData: sampleData.slice(0, 18), columnStats })}

INSTRUCCIONES:
- priorityInsights: hallazgos concretos (números, comparaciones) cuando la muestra/estadística lo permita. Si faltan datos, dilo con honestidad.
- columnRoles: solo nombres que existen literalmente en "headers".

Responde SOLO JSON con esta forma (sin markdown):
${OUTPUT_SHAPE}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = JSON.parse(response.choices[0].message.content || '{}');

    const headerSet = new Set(headers);
    const lowerToExact = new Map(headers.map((h) => [h.toLowerCase().trim(), h]));
    const matchHeader = (needle: string): string | null => {
      const t = needle.trim();
      if (headerSet.has(t)) return t;
      return lowerToExact.get(t.toLowerCase()) ?? null;
    };
    const roles = raw.columnRoles && typeof raw.columnRoles === 'object' ? raw.columnRoles : {};
    const validRoles: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(roles)) {
      if (v == null) {
        validRoles[k] = null;
        continue;
      }
      if (typeof v === 'string') {
        const m = matchHeader(v);
        validRoles[k] = m;
      } else {
        validRoles[k] = null;
      }
    }

    const out = {
      domain: typeof raw.domain === 'string' ? raw.domain : '—',
      narrative: typeof raw.narrative === 'string' ? raw.narrative : '',
      priorityInsights: Array.isArray(raw.priorityInsights)
        ? raw.priorityInsights.filter((x: unknown) => typeof x === 'string').slice(0, 8)
        : [],
      columnRoles: validRoles,
    };

    if (response.usage) {
      await logAIUsage({
        userId: session.user.id,
        actionType: 'interpret-schema',
        usage: response.usage,
        requestPayload: { fileName, headerCount: headers.length },
        responsePayload: { columnRoles: out.columnRoles },
      });
    }
    await logApiCall(session.user.id, 'interpret-schema');

    return NextResponse.json(out);
  } catch (e) {
    console.error('interpret-schema', e);
    return NextResponse.json({ error: 'Error al interpretar' }, { status: 500 });
  }
}
