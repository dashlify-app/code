'use client';

import { SessionProvider } from 'next-auth/react';
import { TextScaleProvider } from '@/components/TextScaleProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TextScaleProvider>{children}</TextScaleProvider>
    </SessionProvider>
  );
}
