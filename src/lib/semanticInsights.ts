import type { SemanticContext } from '@/lib/semanticContext';

export type InsightLevel = 'critical' | 'warn' | 'info' | 'ok';

export type Insight = { level: InsightLevel; text: string };

function toNum(val: any): number {
  return parseFloat(String(val).replace(/[$,\s%]/g, '')) || 0;
}

/** Genera bullets accionables según columnas detectadas y filas. */
export function computeSemanticInsights(
  rows: Record<string, any>[],
  sem: SemanticContext
): Insight[] {
  const out: Insight[] = [];
  if (rows.length === 0) return out;

  const { stock, minStock, price, cost, supplier, leadDays, country, brand, category, rating, reviews } =
    sem;

  if (stock && minStock) {
    let critical = 0;
    for (const r of rows) {
      const s = toNum(r[stock]);
      const m = toNum(r[minStock]);
      if (m > 0 && s < m) critical++;
    }
    if (critical > 0) {
      out.push({
        level: 'critical',
        text: `Tienes ${critical} producto(s) con stock por debajo del mínimo — revisa reabastecimiento.`,
      });
    } else {
      out.push({ level: 'ok', text: 'Ningún producto por debajo del stock mínimo detectado en los datos.' });
    }
  } else if (stock) {
    out.push({ level: 'info', text: 'Incluye una columna de stock mínimo / reorden para alertas de riesgo.' });
  }

  if (price && cost) {
    let neg = 0;
    let lowMargin = 0;
    for (const r of rows) {
      const p = toNum(r[price]);
      const c = toNum(r[cost]);
      if (p <= 0 || c < 0) continue;
      const margin = (p - c) / p;
      if (margin < 0) neg++;
      else if (margin < 0.05) lowMargin++;
    }
    if (neg > 0) {
      out.push({
        level: 'critical',
        text: `Hay ${neg} fila(s) con margen negativo (precio < costo) — posible error de precio o costo.`,
      });
    }
    if (lowMargin > 0 && neg === 0) {
      out.push({
        level: 'warn',
        text: `${lowMargin} producto(s) con margen bruto bajo (menor al 5%) — conviene revisar pricing.`,
      });
    }
  }

  if (supplier && leadDays) {
    const bySup: Record<string, number[]> = {};
    for (const r of rows) {
      const s = String(r[supplier] ?? '').trim();
      if (!s) continue;
      const d = toNum(r[leadDays]);
      if (d <= 0) continue;
      if (!bySup[s]) bySup[s] = [];
      bySup[s].push(d);
    }
    const avgs = Object.entries(bySup).map(([name, arr]) => ({
      name,
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    }));
    if (avgs.length >= 2) {
      avgs.sort((a, b) => b.avg - a.avg);
      const worst = avgs[0]!;
      out.push({
        level: 'warn',
        text: `Mayor tiempo de entrega medio: «${worst.name}» (~${worst.avg.toFixed(1)} días). Prioriza alternativas si es crítico.`,
      });
    }
  }

  if (country) {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const c = String(r[country] ?? '').trim();
      if (!c) continue;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    const total = rows.length;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && total > 0 && top[1] / total > 0.5) {
      const name = top[0].toLowerCase();
      if (name.includes('china') || name.includes('chn')) {
        out.push({
          level: 'warn',
          text: 'Alta concentración de origen en China — evalúa riesgo logístico y alternativas.',
        });
      }
    }
  }

  if (rating && stock) {
    let risky = 0;
    for (const r of rows) {
      const rt = toNum(r[rating]);
      const st = toNum(r[stock]);
      if (rt > 0 && rt < 3 && st > 50) risky++;
    }
    if (risky > 0) {
      out.push({
        level: 'warn',
        text: `${risky} producto(s) con rating bajo pero stock alto — riesgo de rotación y marca.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      level: 'info',
      text: `Analizando ${rows.length} filas. Añade columnas (proveedor, país, stock mínimo, costo/precio) para insights más accionables.`,
    });
  }

  return out.slice(0, 6);
}
