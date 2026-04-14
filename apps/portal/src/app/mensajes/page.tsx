'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL — MENSAJES /mensajes (offline compose)
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, MessageSquare, Send, Plus, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { getAll, saveOfflineMessage } from '../../lib/offline-store';
import { useSync } from '../../lib/sync';
import { clsx } from 'clsx';

export default function MensajesPage() {
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [composing, setComposing] = useState(false);
  const [contenido, setContenido] = useState('');
  const [asunto, setAsunto] = useState('');
  const [sent, setSent] = useState(false);
  const pacienteId = typeof window !== 'undefined' ? localStorage.getItem('portal_paciente_id') : null;
  const sedeId = typeof window !== 'undefined' ? localStorage.getItem('portal_sede_id') ?? '' : '';
  const { online, sync } = useSync(pacienteId);

  useEffect(() => {
    getAll<any>('messages').then(all => {
      setMensajes(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }, [sent]);

  const handleSend = async () => {
    if (!contenido.trim()) return;
    await saveOfflineMessage({ sedeId, asunto, contenido });
    setContenido(''); setAsunto(''); setComposing(false); setSent(s => !s);
    if (online) setTimeout(sync, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900">Mensajes</h1>
          <p className="text-xs text-slate-500">{online ? 'En línea' : 'Sin conexión — se enviará al reconectar'}</p>
        </div>
        <button onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold">
          <Plus size={12} /> Nuevo
        </button>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto space-y-3">
        {composing && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-semibold text-slate-900 text-sm">Nuevo mensaje a la clínica</h2>
            <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)}
              placeholder="Asunto (opcional)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
            <textarea value={contenido} onChange={e => setContenido(e.target.value)}
              rows={4} placeholder="Escriba su mensaje aquí..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" />
            {!online && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Clock size={10} /> Sin conexión — el mensaje se guardará y enviará cuando recupere internet
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setComposing(false)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm">Cancelar</button>
              <button onClick={handleSend} disabled={!contenido.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
                <Send size={12} /> {online ? 'Enviar' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {!mensajes.length && !composing ? (
          <div className="text-center py-12">
            <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">Sin mensajes</p>
            <button onClick={() => setComposing(true)} className="mt-3 text-blue-600 text-sm">Enviar mensaje →</button>
          </div>
        ) : mensajes.map(m => (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-medium text-slate-900 text-sm">{m.asunto ?? 'Sin asunto'}</p>
              {m.syncPending ? (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Clock size={9} /> Pendiente
                </span>
              ) : m.leido ? (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle size={9} /> Leído
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-600 line-clamp-2">{m.contenido}</p>
            <p className="text-xs text-slate-400 mt-2">
              {format(new Date(m.createdAt), "d 'de' MMM, HH:mm", { locale: es })}
            </p>
            {m.respuesta && (
              <div className="mt-3 pl-3 border-l-2 border-blue-300">
                <p className="text-xs text-slate-500 mb-1">Respuesta de la clínica</p>
                <p className="text-sm text-slate-700">{m.respuesta}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
