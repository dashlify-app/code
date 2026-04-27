'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  TEXT_SCALE_STORAGE_KEY,
  applyTextScaleToDocument,
  parseStoredTextScale,
  type TextScalePercent,
} from '@/lib/textScale';

type Ctx = {
  scalePercent: TextScalePercent;
  setScalePercent: (p: TextScalePercent) => void;
};

const TextScaleContext = createContext<Ctx | null>(null);

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const [scalePercent, setScaleState] = useState<TextScalePercent>(100);

  useEffect(() => {
    const p = parseStoredTextScale();
    setScaleState(p);
    applyTextScaleToDocument(p);
  }, []);

  const setScalePercent = useCallback((p: TextScalePercent) => {
    setScaleState(p);
    try {
      localStorage.setItem(TEXT_SCALE_STORAGE_KEY, String(p));
    } catch {
      /* ignore */
    }
    applyTextScaleToDocument(p);
    window.dispatchEvent(
      new CustomEvent('dashlify-text-scale-changed', { detail: p })
    );
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TEXT_SCALE_STORAGE_KEY || e.newValue == null) return;
      const n = parseInt(e.newValue, 10);
      if (n === 100 || n === 110 || n === 125 || n === 150) {
        setScaleState(n);
        applyTextScaleToDocument(n);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({ scalePercent, setScalePercent }),
    [scalePercent, setScalePercent]
  );

  return (
    <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>
  );
}

export function useTextScale(): Ctx {
  const ctx = useContext(TextScaleContext);
  if (!ctx) {
    throw new Error('useTextScale debe usarse dentro de TextScaleProvider');
  }
  return ctx;
}
