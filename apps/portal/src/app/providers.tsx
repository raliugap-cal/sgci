'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import BottomNav from '../components/BottomNav';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 2 * 60 * 1000, retry: 1, refetchOnWindowFocus: false } } });

const PUBLIC_PATHS = ['/login', '/offline'];

export default function PortalProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  return (
    <QueryClientProvider client={qc}>
      {children}
      {!isPublic && <BottomNav />}
    </QueryClientProvider>
  );
}
