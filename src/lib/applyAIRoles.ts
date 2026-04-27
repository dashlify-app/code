import type { SemanticContext } from '@/lib/semanticContext';

const MAPPABLE_KEYS: (keyof SemanticContext)[] = [
  'category',
  'family',
  'subfamily',
  'productName',
  'price',
  'cost',
  'stock',
  'minStock',
  'brand',
  'supplier',
  'country',
  'leadDays',
  'warehouse',
  'rating',
  'reviews',
  'dateField',
];

/** Alinea un nombre de columna devuelto por el modelo con el array real (mayúsculas / espacios). */
export function resolveHeader(s: string | null | undefined, headers: string[]): string | null {
  if (s == null || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  if (headers.includes(t)) return t;
  const low = t.toLowerCase();
  return headers.find((h) => h.toLowerCase() === low) ?? null;
}

/**
 * Sobre el contexto heurístico, aplica mapeo de la IA (solo si el encabezado existe).
 * `dateColumns` no se pisa: siguen viniendo del detector de tipos.
 */
export function applyAIRoles(
  base: SemanticContext,
  roles: Record<string, string | null | undefined> | null | undefined,
  headers: string[]
): SemanticContext {
  if (!roles) return base;
  const next: SemanticContext = { ...base };
  const set = (k: keyof SemanticContext, val: string | null | undefined) => {
    const r = resolveHeader(val == null ? null : String(val), headers);
    if (!r) return;
    (next as Record<keyof SemanticContext, string | null | string[]>)[k] = r;
  };
  for (const key of MAPPABLE_KEYS) {
    set(key, roles[key as string] as string | null | undefined);
  }
  return next;
}
