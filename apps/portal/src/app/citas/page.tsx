'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL — MIS CITAS /citas (offline-first)
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { format, isFuture, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar, Video, Stethoscope, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { getAll } from '../../lib/offline-store';
import { clsx } from 'clsx';

const ESTADO_COLOR: Record<string, string> = {
  CONFIRMADA:  'bg-blue-100 text-blue-700',
  EN_ESPERA:   'bg-yellow-100 text-yellow-700',
  COMPLETADA:  'bg-emerald-100 text-emerald-700',
  CANCELADA:   'bg-red-100 text-red-600',
  NO_SHOW:     'bg-orange-100 text-orange-600',
  PROGRAMADA:  'bg-slate-100 text-slate-600',
};

export function CitasPage() {
  const [citas, setCitas] = useState<any[]>([]);
  const [tab, setTab] = useState<'proximas' | 'pasadas'>('proximas');

  useEffect(() => {
    getAll<any>('appointments').then(all => {
      setCitas(all.sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()));
    });
  }, []);

  const proximas = citas.filter(c => isFuture(new Date(c.fechaInicio)) && !['CANCELADA','NO_SHOW'].includes(c.estado));
  const pasadas = citas.filter(c => isPast(new Date(c.fechaInicio)) || ['CANCELADA','NO_SHOW'].includes(c.estado));
  const lista = tab === 'proximas' ? proximas : pasadas;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={16} /></Link>
        <h1 className="font-bold text-slate-900">Mis citas</h1>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto space-y-4">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(['proximas', 'pasadas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
              {t === 'proximas' ? `Próximas (${proximas.length})` : `Historial (${pasadas.length})`}
            </button>
          ))}
        </div>

        {!lista.length ? (
          <div className="text-center py-12">
            <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">Sin citas {tab}</p>
          </div>
        ) : lista.map(cita => {
          const fecha = new Date(cita.fechaInicio);
          const estadoCfg = ESTADO_COLOR[cita.estado] ?? ESTADO_COLOR.PROGRAMADA;
          return (
            <div key={cita.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-slate-500 text-sm">{format(fecha, 'HH:mm')} hrs</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', estadoCfg)}>
                    {cita.estado?.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    {cita.esTelemedicina ? <Video size={13} className="text-blue-500" /> : <Stethoscope size={13} />}
                    Dr(a). {cita.medico?.usuario?.nombre} {cita.medico?.usuario?.apellidoPaterno}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-slate-400" />
                    {cita.sede?.nombre ?? 'Sede principal'}
                  </div>
                  {cita.tipoCita && (
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-400" />
                      {cita.tipoCita.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>

                {cita.esTelemedicina && cita.dailyRoomUrl && cita.estado === 'CONFIRMADA' && (
                  <a href={cita.dailyRoomUrl} target="_blank" rel="noreferrer"
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                    <Video size={14} /> Entrar a videoconsulta
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default CitasPage;
