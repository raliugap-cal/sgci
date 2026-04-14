'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL — VIDEOCONSULTA /telemedicina/[citaId]
// El paciente entra a su sala Daily.co desde el portal
// Disponible SOLO online (WebRTC requiere conexión)
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Video, ArrowLeft, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { portalApi } from '../../lib/sync';

export default function VideoconsultaPage() {
  const { citaId } = useParams<{ citaId: string }>();
  const router = useRouter();
  const [tokenData, setTokenData] = useState<{ roomUrl: string; token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!online) { setLoading(false); return; }
    portalApi.get(`/appointments/${citaId}/telehealth-token`)
      .then(res => setTokenData(res.data))
      .catch(e => setError(e.response?.data?.message ?? 'No se pudo obtener acceso a la sala'))
      .finally(() => setLoading(false));
  }, [citaId, online]);

  if (!online) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <WifiOff size={48} className="text-slate-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Sin conexión</h2>
        <p className="text-slate-400 text-sm mb-6">La videoconsulta requiere conexión a internet.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-semibold">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Conectando a su sala...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">No disponible</h2>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button onClick={() => router.back()}
          className="px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-semibold">
          Volver
        </button>
      </div>
    );
  }

  const roomSrc = tokenData
    ? `${tokenData.roomUrl}?t=${tokenData.token}&lang=es&showLeaveButton=0&showFullscreenButton=1`
    : '';

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header mínimo */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white shrink-0">
        <div className="flex items-center gap-3">
          <Video size={18} className="text-blue-400" />
          <span className="font-semibold text-sm">Mi videoconsulta</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-400">
          <Wifi size={12} /> Conectado
        </div>
      </div>

      {/* Iframe Daily.co */}
      <iframe
        src={roomSrc}
        allow="camera; microphone; fullscreen; speaker; display-capture"
        className="flex-1 w-full border-0"
        title="Videoconsulta"
      />

      {/* Botón de salir */}
      <div className="flex justify-center py-3 bg-slate-800 shrink-0">
        <button onClick={() => router.push('/citas')}
          className="px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
          Terminar consulta
        </button>
      </div>
    </div>
  );
}
