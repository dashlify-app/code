/**
 * Trazas solo en desarrollo. En producción no imprimen nada (evita ruido y datos sensibles en logs).
 * Para volúmenes grandes (JSON de IA), usa `devVerbose` y activa LOG_VERBOSE=1 o NEXT_PUBLIC_LOG_VERBOSE=1.
 */

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

function verboseEnabled(): boolean {
  return (
    process.env.LOG_VERBOSE === '1' || process.env.NEXT_PUBLIC_LOG_VERBOSE === '1'
  );
}

export function devLog(...args: unknown[]): void {
  if (!isDev()) return;
  console.log(...args);
}

/** Solo en desarrollo y con LOG_VERBOSE / NEXT_PUBLIC_LOG_VERBOSE = 1 */
export function devVerbose(...args: unknown[]): void {
  if (!isDev() || !verboseEnabled()) return;
  console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (!isDev()) return;
  console.warn(...args);
}
