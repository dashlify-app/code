export interface ColumnStat {
  col: string;
  type: 'numeric' | 'categorical' | 'date';
  nullCount: number;
  uniqueCount: number;
  // numeric only
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  // categorical/date only
  top5?: string[];
}

export function computeColumnStats(
  rows: Record<string, any>[],
  headers: string[]
): ColumnStat[] {
  if (!rows.length) return [];

  return headers.map(col => {
    const rawValues = rows.map(r => r[col]);
    const nonNull = rawValues.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = rows.length - nonNull.length;
    const unique = [...new Set(nonNull.map(String))];

    const numerics = nonNull
      .map(v => parseFloat(String(v).replace(/[$,\s%]/g, '')))
      .filter(n => !isNaN(n));

    if (numerics.length > 0 && numerics.length >= nonNull.length * 0.6) {
      const min = Math.min(...numerics);
      const max = Math.max(...numerics);
      const avg = numerics.reduce((a, b) => a + b, 0) / numerics.length;
      const variance =
        numerics.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / numerics.length;
      return {
        col,
        type: 'numeric' as const,
        nullCount,
        uniqueCount: unique.length,
        min: +min.toFixed(2),
        max: +max.toFixed(2),
        avg: +avg.toFixed(2),
        stddev: +Math.sqrt(variance).toFixed(2),
      };
    }

    const sample = nonNull.slice(0, 20);
    const dateHits = sample.filter(v => {
      const s = String(v);
      return s.length >= 6 && !isNaN(Date.parse(s));
    }).length;
    const isDate = dateHits >= sample.length * 0.7 && sample.length > 0;

    return {
      col,
      type: isDate ? ('date' as const) : ('categorical' as const),
      nullCount,
      uniqueCount: unique.length,
      top5: unique.slice(0, 5),
    };
  });
}
