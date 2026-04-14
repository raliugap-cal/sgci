// ═══════════════════════════════════════════════════════════
// OFFLINE PAGE — Mostrada cuando no hay caché disponible
// ═══════════════════════════════════════════════════════════
'use client';
import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <WifiOff size={28} className="text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Sin conexión</h1>
        <p className="text-slate-500 text-sm mb-6">
          Esta página no está disponible sin internet. Sus datos guardados (citas, salud, diario)
          siguen accesibles desde la pantalla de inicio.
        </p>
        <div className="space-y-2">
          <Link
            href="/dashboard"
            className="block w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold"
          >
            Ir al inicio
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full py-3 border border-slate-200 text-slate-600 rounded-xl text-sm"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
