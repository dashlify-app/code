/**
 * Limpia un widget antes de guardarlo en BD.
 *
 * Remueve `sampleData`, `headers` y otras propiedades pesadas del config
 * para evitar payloads enormes (que causan 413 Content Too Large).
 *
 * Los datos NO se pierden: al cargar el dashboard, `hydrateDashboardWidgets`
 * recarga `sampleData` desde el Dataset original usando `datasetIndex`/`datasetName`.
 *
 * Uso:
 *   const payload = { widgets: widgets.map(cleanWidgetForSave) };
 *   await fetch('/api/dashboards', { body: JSON.stringify(payload) });
 */

export interface SavableWidget {
  type: string;
  title?: string;
  category?: string;
  description?: string;
  config: Record<string, unknown>;
}

/** Claves que NUNCA deben enviarse al servidor (datos voluminosos). */
const STRIPPED_KEYS = ['sampleData', 'headers', 'rawSchema', 'analysis'] as const;

/**
 * Devuelve una copia del widget con su `config` limpio de campos pesados.
 * Mantiene `datasetId` (FK), `datasetName` y `datasetIndex` como referencias al Dataset original.
 */
export function cleanWidgetForSave<T extends { config?: any; [key: string]: any }>(
  widget: T
): T {
  const cfg = widget.config && typeof widget.config === 'object' ? { ...widget.config } : {};

  // Strip claves pesadas
  for (const key of STRIPPED_KEYS) {
    delete cfg[key];
  }

  // Asegura referencias al dataset (id es preferido, name/index son fallback)
  cfg.datasetId = typeof cfg.datasetId === 'string' && cfg.datasetId ? cfg.datasetId : undefined;
  cfg.datasetIndex = typeof cfg.datasetIndex === 'number' ? cfg.datasetIndex : 0;
  cfg.datasetName = typeof cfg.datasetName === 'string' ? cfg.datasetName : undefined;

  return { ...widget, config: cfg };
}

/**
 * Limpia un array de widgets en una sola llamada.
 */
export function cleanWidgetsForSave<T extends { config?: any; [key: string]: any }>(
  widgets: T[]
): T[] {
  return widgets.map(cleanWidgetForSave);
}

/**
 * Estima el tamaño en bytes del payload (para debugging).
 */
export function estimatePayloadSize(payload: unknown): number {
  return new Blob([JSON.stringify(payload)]).size;
}
