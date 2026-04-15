'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '../lib/auth-store';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            1000 * 60 * 2,  // 2 min
        retry:                1,
        refetchOnWindowFocus: false,
        refetchOnMount:       true,
      },
      mutations: {
        retry: 0,
      },
    },
  }));

  return (
    <QueryClientProvider client={qc}>
      {children}
    </QueryClientProvider>
  );
}
