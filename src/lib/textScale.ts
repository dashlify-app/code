/** Preferencia de tamaño de texto (toda la app). Valor = porcentaje del tamaño base. */
export const TEXT_SCALE_STORAGE_KEY = 'dashlify-text-scale';

export type TextScalePercent = 100 | 110 | 125 | 150;

export const TEXT_SCALE_OPTIONS: {
  value: TextScalePercent;
  label: string;
  hint: string;
}[] = [
  { value: 100, label: 'Predeterminado', hint: '100 %' },
  { value: 110, label: 'Grande', hint: '110 %' },
  { value: 125, label: 'Muy grande', hint: '125 %' },
  { value: 150, label: 'Extra grande', hint: '150 %' },
];

export function parseStoredTextScale(): TextScalePercent {
  if (typeof window === 'undefined') return 100;
  const raw = localStorage.getItem(TEXT_SCALE_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 100;
  if (n === 100 || n === 110 || n === 125 || n === 150) return n;
  return 100;
}

/**
 * Escala toda la interfaz (texto, controles, gráficos con px).
 * `zoom` en el documento es la forma más consistente frente a estilos en px y en rem.
 */
export function applyTextScaleToDocument(percent: TextScalePercent): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-text-scale', String(percent));
  if (percent === 100) {
    document.documentElement.style.removeProperty('zoom');
  } else {
    document.documentElement.style.zoom = String(percent / 100);
  }
}
