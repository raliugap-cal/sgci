'use client';
// ═══════════════════════════════════════════════════════════
// AGENDA — /agenda
// Vista diaria · Selector de médico/sede · Check-in · Cita nueva
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, startOfWeek, eachDayOfInterval, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Video,
  Clock, User, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import { appointmentsApi, adminApi } from '../../../lib/api';
import { useAuthStore } from '../../../lib/auth-store';
import { clsx } from 'clsx';

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 – 20:00
const ESTADO_COLOR: Record<string, string> = {
  PROGRAMADA:  'bg-slate-100 border-slate-300 text-slate-700',
  CONFIRMADA:  'bg-blue-100 border-blue-400 text-blue-800',
  EN_ESPERA:   'bg-yellow-100 border-yellow-400 text-yellow-800',
  EN_CONSULTA: 'bg-green-100 border-green-400 text-green-800',
  COMPLETADA:  'bg-emerald-50 border-emerald-300 text-emerald-700',
  CANCELADA:   'bg-red-50 border-red-300 text-red-600',
  NO_SHOW:     'bg-orange-50 border-orange-300 text-orange-600',
};

function TimeSlotCita({ cita, onCheckIn }: { cita: any; onCheckIn: (id: string) => void }) {
  const inicio = parseISO(cita.fechaInicio);
  const fin = parseISO(cita.fechaFin);
  const durMin = (fin.getTime() - inicio.getTime()) / 60000;
  const topOffset = (inicio.getMinutes() / 60) * 64; // 64px por hora
  const height = Math.max((durMin / 60) * 64, 28);
  const colorClass = ESTADO_COLOR[cita.estado] ?? ESTADO_COLOR.PROGRAMADA;

  return (
    <div
      className={clsx(
        'absolute left-1 right-1 rounded-lg border px-2 py-1 overflow-hidden text-xs cursor-pointer hover:shadow-md transition-shadow group',
        colorClass,
      )}
      style={{ top: topOffset, height }}
    >
      <div className="font-semibold truncate flex items-center gap-1">
        {cita.esTelemedicina && <Video size={10} />}
        {cita.paciente?.nombre} {cita.paciente?.apellidoPaterno}
      </div>
      <div className="text-opacity-70 truncate">
        {format(inicio, 'HH:mm')} — {cita.tipoCita?.replace(/_/g, ' ')}
      </div>
      {cita.estado === 'CONFIRMADA' && (
        <button
          onClick={(e) => { e.stopPropagation(); onCheckIn(cita.id); }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-green-600 text-white rounded px-1 text-xs"
        >
          Check-in
        </button>
      )}
    </div>
  );
}

export default function AgendaPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(new Date());
  const [medicoId, setMedicoId] = useState<string>(user?.medicoId ?? '');
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');

  const fechaStr = format(fecha, 'yyyy-MM-dd');

  // Médicos disponibles
  const { data: medicos } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => {
      const { data } = await adminApi.getMedicos();
      return data;
    },
  });

  // Citas del día
  const { data: citasData, isLoading } = useQuery({
    queryKey: ['agenda', fechaStr, medicoId],
    queryFn: async () => {
      const { data } = await appointmentsApi.findAll({
        fecha: fechaStr,
        medicoId: medicoId || undefined,
        limit: 100,
      });
      return data;
    },
    refetchInterval: 30000,
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.checkIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  });

  const citas: any[] = citasData?.data ?? [];

  // Semana actual para la vista semanal
  const semana = eachDayOfInterval({
    start: startOfWeek(fecha, { weekStartsOn: 1 }),
    end: addDays(startOfWeek(fecha, { weekStartsOn: 1 }), 6),
  });

  return (
    <AppShell>
      <div className="h-[calc(100vh-120px)] flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {/* Navegación de fecha */}
          <div className="flex items-center gap-2">
            <button onClick={() => setFecha(d => subDays(d, 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setFecha(new Date())}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium border',
                isToday(fecha) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              {isToday(fecha) ? 'Hoy' : format(fecha, "d 'de' MMMM", { locale: es })}
            </button>
            <button onClick={() => setFecha(d => addDays(d, 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
              <ChevronRight size={16} />
            </button>
          </div>

          <span className="text-sm font-semibold text-slate-900 capitalize">
            {format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Selector de médico */}
            <select
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="">Todos los médicos</option>
              {medicos?.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.usuario.nombre} {m.usuario.apellidoPaterno}
                </option>
              ))}
            </select>

            {/* Vista */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['dia', 'semana'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)}
                  className={clsx(
                    'px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                    vista === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
                  )}
                >
                  {v === 'dia' ? 'Día' : 'Semana'}
                </button>
              ))}
            </div>

            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['agenda'] })}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500"
            >
              <RefreshCw size={14} />
            </button>

            <Link href="/agenda/nueva-cita"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus size={14} /> Nueva cita
            </Link>
          </div>
        </div>

        {/* Resumen del día */}
        <div className="flex gap-3 shrink-0">
          {[
            { label: 'Total', value: citas.length, color: 'text-slate-700' },
            { label: 'Confirmadas', value: citas.filter(c => c.estado === 'CONFIRMADA').length, color: 'text-blue-600' },
            { label: 'En espera', value: citas.filter(c => c.estado === 'EN_ESPERA').length, color: 'text-yellow-600' },
            { label: 'Completadas', value: citas.filter(c => c.estado === 'COMPLETADA').length, color: 'text-emerald-600' },
            { label: 'Canceladas', value: citas.filter(c => c.estado === 'CANCELADA').length, color: 'text-red-500' },
            { label: 'Telemedicina', value: citas.filter(c => c.esTelemedicina).length, color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 px-3 py-2 text-center">
              <p className={clsx('text-lg font-bold', color)}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Vista de semana — selector de día */}
        {vista === 'semana' && (
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-2 shrink-0">
            {semana.map(day => {
              const citasDelDia = citas.filter(c =>
                format(parseISO(c.fechaInicio), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
              );
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setFecha(day)}
                  className={clsx(
                    'flex-1 flex flex-col items-center py-2 rounded-lg text-xs transition-colors',
                    format(day, 'yyyy-MM-dd') === fechaStr
                      ? 'bg-blue-600 text-white'
                      : isToday(day) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600',
                  )}
                >
                  <span className="font-medium capitalize">{format(day, 'EEE', { locale: es })}</span>
                  <span className="text-base font-bold mt-0.5">{format(day, 'd')}</span>
                  {citasDelDia.length > 0 && (
                    <span className={clsx(
                      'w-4 h-4 rounded-full text-xs flex items-center justify-center mt-0.5 font-bold',
                      format(day, 'yyyy-MM-dd') === fechaStr ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700',
                    )}>
                      {citasDelDia.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Grid de agenda */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex">
              {/* Columna de horas */}
              <div className="w-14 shrink-0 border-r border-slate-100">
                {HORAS.map(h => (
                  <div key={h} className="h-16 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-slate-400">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Columna de citas */}
              <div className="flex-1 relative">
                {/* Líneas de hora */}
                {HORAS.map(h => (
                  <div key={h} className="h-16 border-b border-slate-50" />
                ))}

                {/* Línea de hora actual */}
                {isToday(fecha) && (() => {
                  const now = new Date();
                  const horaActual = now.getHours() + now.getMinutes() / 60;
                  const top = (horaActual - 7) * 64;
                  return top > 0 && top < HORAS.length * 64 ? (
                    <div className="absolute left-0 right-0 z-10" style={{ top }}>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 shrink-0" />
                        <div className="flex-1 h-0.5 bg-red-400" />
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Citas del día */}
                <div className="absolute inset-0">
                  {citas.map(cita => {
                    const inicio = parseISO(cita.fechaInicio);
                    const horaInicio = inicio.getHours() + inicio.getMinutes() / 60;
                    const topPx = (horaInicio - 7) * 64;
                    if (topPx < 0) return null;
                    return (
                      <div key={cita.id} style={{ position: 'absolute', top: topPx, left: 0, right: 0 }}>
                        <TimeSlotCita cita={cita} onCheckIn={id => checkInMutation.mutate(id)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
