'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Leer directamente desde localStorage — fuente de verdad
    const token = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('sgci-auth');
    
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.accessToken && parsed?.state?.user) {
          setAuthed(true);
          setReady(true);
          return;
        }
      } catch {}
    }
    
    setAuthed(false);
    setReady(true);
    router.replace('/login');
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
