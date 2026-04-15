'use client';
// ═══════════════════════════════════════════════════════════
// SALA DE VIDEOCONSULTA — /telemedicina/[citaId]
// Médico entra a la sala Daily.co durante la consulta
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, Phone, Users } from 'lucide-react';
import AppShell from '../../../../components/AppShell';
import { appointmentsApi } from '../../../../lib/api';
import { useAuthStore } from '../../../../lib/auth-store';

export default function TelemedicinaPage() {
  const { citaId } = useParams<{ citaId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [connected, setConnected] = useState(false);

  const { data: citaData } = useQuery({
    queryKey: ['cita-telehealth', citaId],
    queryFn: async () => {
      const { data } = await appointmentsApi.findById(citaId);
      return data;
    },
  });

  const roomUrl = citaData?.dailyRoomUrl;
  const medicoToken = citaData?.dailyRoomToken;

  useEffect(() => {
    if (!roomUrl) return;
    // La sala se carga en el iframe de Daily.co
    setConnected(true);
  }, [roomUrl]);

  const handleEndCall = () => {
    if (frameRef.current) {
      // Enviar mensaje al iframe de Daily para colgar
      frameRef.current.contentWindow?.postMessage({ action: 'leave-meeting' }, '*');
    }
    router.push(`/consulta/${citaData?.consulta?.id ?? citaId}`);
  };

  if (!roomUrl) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando sala de videoconsulta...</p>
        </div>
      </AppShell>
    );
  }

  // Construir URL con parámetros de Daily
  const dailyUrl = `${roomUrl}?t=${medicoToken ?? ''}&lang=es&iframeDriver=1&showLeaveButton=0&showFullscreenButton=1`;

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="font-semibold text-sm">
              {citaData?.paciente?.nombre} {citaData?.paciente?.apellidoPaterno}
            </p>
            <p className="text-xs text-slate-400">Videoconsulta · {citaData?.tipoCita?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> En línea
          </span>}
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Users size={12} /> Daily.co
          </span>
        </div>
      </div>

      {/* Video frame */}
      <div className="flex-1 relative">
        <iframe
          ref={frameRef}
          src={dailyUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          className="w-full h-full border-0"
          title="Sala de videoconsulta"
        />
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-4 py-4 bg-slate-800 shrink-0">
        <button
          onClick={() => setMic(v => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${mic ? 'bg-slate-600 hover:bg-slate-500' : 'bg-red-600 hover:bg-red-700'}`}
          title={mic ? 'Silenciar' : 'Activar micrófono'}
        >
          {mic ? <Mic size={18} className="text-white" /> : <MicOff size={18} className="text-white" />}
        </button>

        <button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
          title="Terminar llamada"
        >
          <Phone size={20} className="text-white rotate-[135deg]" />
        </button>

        <button
          onClick={() => setCam(v => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${cam ? 'bg-slate-600 hover:bg-slate-500' : 'bg-red-600 hover:bg-red-700'}`}
          title={cam ? 'Apagar cámara' : 'Encender cámara'}
        >
          {cam ? <Video size={18} className="text-white" /> : <VideoOff size={18} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
