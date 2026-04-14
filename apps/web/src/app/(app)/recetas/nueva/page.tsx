'use client';
// /recetas/nueva — redirect to recetas page with tab=nueva
// Esta page es un alias para ir a /recetas con la vista de crear receta activa
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NuevaRecetaRedirect() {
  const router = useRouter();
  const sp = useSearchParams();
  const consultaId = sp.get('consultaId') ?? '';
  const pacienteId = sp.get('pacienteId') ?? '';

  useEffect(() => {
    const params = new URLSearchParams();
    if (consultaId) params.set('consultaId', consultaId);
    if (pacienteId) params.set('pacienteId', pacienteId);
    params.set('tab', 'nueva');
    router.replace(`/recetas?${params.toString()}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
