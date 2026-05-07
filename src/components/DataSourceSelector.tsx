'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UploadZone from './UploadZone';
import GoogleSheetsWorkbench from './GoogleSheetsWorkbench';

type TabType = 'upload' | 'google';

export function DataSourceSelector({ onWideChange }: { onWideChange?: (wide: boolean) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = params?.get('tab');
    return tab === 'google' ? 'google' : 'upload';
  });

  useEffect(() => {
    setIsMounted(true);
    setGoogleEnabled(localStorage.getItem('dashlify-google-enabled') === '1');
  }, []);

  useEffect(() => {
    if (!googleEnabled) {
      setActiveTab('upload');
      return;
    }
    const tab = params?.get('tab');
    if (tab === 'google' && googleEnabled) setActiveTab('google');
    else if (tab === 'upload') setActiveTab('upload');
  }, [params, googleEnabled]);

  const setTab = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const q = new URLSearchParams(params?.toString() ?? '');
      q.set('action', 'upload');
      q.set('tab', tab);
      router.replace(`/dashboard?${q.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    const onToggle = (e: Event) => {
      const enabled = (e as CustomEvent<{ enabled: boolean }>).detail?.enabled;
      setGoogleEnabled(Boolean(enabled));
      if (!enabled) setActiveTab('upload');
    };
    window.addEventListener('dashlify:google-enabled-changed', onToggle as EventListener);
    return () => window.removeEventListener('dashlify:google-enabled-changed', onToggle as EventListener);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="data-source-selector">
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setTab('upload')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'upload' ? 'var(--accent)' : 'var(--text2)',
            borderBottom: activeTab === 'upload' ? '3px solid var(--accent)' : 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: activeTab === 'upload' ? 'bold' : 'normal',
            marginBottom: '-2px',
            transition: 'color 0.2s',
          }}
        >
          📁 Subir archivos
        </button>
        {googleEnabled && (
          <button
            onClick={() => setTab('google')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'google' ? 'var(--accent)' : 'var(--text2)',
              borderBottom: activeTab === 'google' ? '3px solid var(--accent)' : 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: activeTab === 'google' ? 'bold' : 'normal',
              marginBottom: '-2px',
              transition: 'color 0.2s',
            }}
          >
            🔗 Google Sheets
          </button>
        )}
      </div>

      {activeTab === 'upload' && (
        <div>
          <UploadZone onWideChange={onWideChange} />
        </div>
      )}

      {googleEnabled && activeTab === 'google' && <GoogleSheetsWorkbench onWideChange={onWideChange} />}
    </div>
  );
}
