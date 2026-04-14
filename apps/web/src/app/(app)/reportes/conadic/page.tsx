'use client';
// /reportes/conadic — redirect to reportes with conadic tab
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConadicRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/reportes?tab=conadic'); }, []);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
