'use client';
// ═══════════════════════════════════════════════════════════
// DIARIO DE CONSUMO — /diario
// Registro offline-first · Badge de pendientes
// Historial del mes · Dashboard visual
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfMonth, eachDayOfInterval, endOfMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle, XCircle, Plus, ArrowLeft, AlertCircle,
  TrendingDown, Calendar, Wifi, WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { saveDiaryEntry, getAll } from '../../lib/offline-store';
import { useSync } from '../../lib/sync';
import { clsx } from 'clsx';

const diarySchema = z.object({
  huboConsumo: z.boolean(),
  estadoAnimo: z.number().min(1).max(10).optional(),
  nivelAnsiedad: z.number().min(1).max(10).optional(),
  notas: z.string().optional(),
  sustanciaNombre: z.string().optional(),
  sustanciaCantidad: z.number().optional(),
});

type DiaryForm = z.infer<typeof diarySchema>;

const SUSTANCIAS_COMUNES = [
  'Alcohol', 'Marihuana', 'Cocaína', 'Metanfetamina',
  'Heroína', 'Benzodiacepinas', 'Opioides', 'Otro',
];

function EmojiScale({ value, onChange, label, emoji }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} {value ? `(${value}/10)` : ''}
      </label>
      <div className="flex gap-1">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={clsx(
              'flex-1 h-9 rounded-lg text-sm font-medium transition-colors',
              value === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarDot({ hasEntry, huboConsumo }: { hasEntry: boolean; huboConsumo?: boolean }) {
  if (!hasEntry) return <div className="w-2 h-2 rounded-full bg-slate-200 mx-auto" />;
  return (
    <div className={clsx(
      'w-2 h-2 rounded-full mx-auto',
      huboConsumo ? 'bg-red-500' : 'bg-green-500',
    )} />
  );
}

export default function DiarioPage() {
  const [showForm, setShowForm] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  const [expedienteId, setExpedienteId] = useState<string | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);

  const { online, pendingCount, sync } = useSync(pacienteId);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<DiaryForm>({
    resolver: zodResolver(diarySchema),
    defaultValues: { huboConsumo: false },
  });

  const huboConsumo = watch('huboConsumo');
  const estadoAnimo = watch('estadoAnimo');
  const nivelAnsiedad = watch('nivelAnsiedad');

  useEffect(() => {
    const eid = localStorage.getItem('portal_expediente_adiccion_id');
    const pid = localStorage.getItem('portal_paciente_id');
    if (eid) setExpedienteId(eid);
    if (pid) setPacienteId(pid);
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const all = await getAll<any>('diary');
    const sorted = all.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setEntries(sorted);
  };

  const todayEntry = entries.find(e => isSameDay(new Date(e.fecha), new Date()));

  const onSubmit = async (data: DiaryForm) => {
    if (!expedienteId) return;

    const sustancias = data.huboConsumo && data.sustanciaNombre ? [{
      sustancia: data.sustanciaNombre,
      cantidad: data.sustanciaCantidad ?? 1,
      unidad: 'dosis',
    }] : [];

    await saveDiaryEntry({
      expedienteAdiccionId: expedienteId,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      huboConsumo: data.huboConsumo,
      sustancias,
      estadoAnimo: data.estadoAnimo,
      nivelAnsiedad: data.nivelAnsiedad,
      notas: data.notas,
    });

    await loadEntries();
    setSaved(true);
    setShowForm(false);
    reset();

    // Intentar sync si hay conexión
    if (online) setTimeout(sync, 1000);
  };

  // Días del mes actual para el calendario
  const diasMes = eachDayOfInterval({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  const diasSinConsumo = entries.filter(e => !e.huboConsumo).length;
  const diasConConsumo = entries.filter(e => e.huboConsumo).length;

  if (!expedienteId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm">
          <AlertCircle size={36} className="mx-auto text-slate-300 mb-3" />
          <h2 className="font-bold text-slate-900 mb-2">Sin expediente de adicciones</h2>
          <p className="text-slate-500 text-sm">
            El diario de consumo está disponible para pacientes en tratamiento de adicciones.
          </p>
          <Link href="/dashboard" className="mt-4 block text-blue-600 text-sm">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900">Mi diario</h1>
          <p className="text-xs text-slate-500">{format(new Date(), "MMMM yyyy", { locale: es })}</p>
        </div>
        <div className={clsx(
          'flex items-center gap-1 text-xs px-2 py-1 rounded-full',
          online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
        )}>
          {online ? <Wifi size={10} /> : <WifiOff size={10} />}
          {online ? 'En línea' : 'Sin conexión'}
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-md mx-auto">

        {/* Pendientes de sync */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <AlertCircle size={14} className="shrink-0" />
            {pendingCount} registro{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de sincronizar
            {online && (
              <button onClick={sync} className="ml-auto text-xs underline">Sincronizar ahora</button>
            )}
          </div>
        )}

        {/* Registro de hoy */}
        {!todayEntry && !showForm && !saved && (
          <div className="bg-blue-600 text-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} />
              <span className="font-semibold">Registro de hoy</span>
            </div>
            <p className="text-blue-200 text-sm mb-4">
              ¿Cómo estuvo tu día? Registra tu consumo aunque estés sin internet.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-white text-blue-600 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Registrar hoy
            </button>
          </div>
        )}

        {todayEntry && (
          <div className={clsx(
            'rounded-2xl p-5 border',
            todayEntry.huboConsumo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200',
          )}>
            <div className="flex items-center gap-2 mb-1">
              {todayEntry.huboConsumo
                ? <XCircle size={16} className="text-red-600" />
                : <CheckCircle size={16} className="text-green-600" />
              }
              <span className={clsx('font-semibold text-sm', todayEntry.huboConsumo ? 'text-red-700' : 'text-green-700')}>
                Registro de hoy guardado {todayEntry.syncPending ? '· Pendiente de sync' : '· Sincronizado'}
              </span>
            </div>
            {todayEntry.notas && (
              <p className="text-sm text-slate-600 mt-1">{todayEntry.notas}</p>
            )}
          </div>
        )}

        {saved && !todayEntry && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">¡Registro guardado correctamente!</span>
          </div>
        )}

        {/* Formulario de registro */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Registro de hoy</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* ¿Hubo consumo? */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ¿Consumiste alguna sustancia hoy?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[false, true].map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setValue('huboConsumo', val)}
                      className={clsx(
                        'py-3 rounded-xl text-sm font-semibold border-2 transition-all',
                        huboConsumo === val
                          ? val ? 'bg-red-600 border-red-600 text-white' : 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      {val ? '❌ Sí' : '✅ No'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sustancia (solo si hubo consumo) */}
              {huboConsumo && (
                <div className="space-y-3 bg-red-50 rounded-xl p-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">¿Qué sustancia?</label>
                    <select
                      {...register('sustanciaNombre')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">Seleccionar...</option>
                      {SUSTANCIAS_COMUNES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad aproximada</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      {...register('sustanciaCantidad', { valueAsNumber: true })}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Estado de ánimo */}
              <EmojiScale
                label="Estado de ánimo"
                value={estadoAnimo}
                onChange={(v: number) => setValue('estadoAnimo', v)}
              />

              {/* Nivel de ansiedad */}
              <EmojiScale
                label="Nivel de ansiedad"
                value={nivelAnsiedad}
                onChange={(v: number) => setValue('nivelAnsiedad', v)}
              />

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ¿Algo que quieras anotar?
                </label>
                <textarea
                  {...register('notas')}
                  rows={3}
                  placeholder="Cómo me sentí, qué me ayudó, situaciones difíciles..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Estadísticas del mes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{diasSinConsumo}</p>
            <p className="text-xs text-green-600 mt-1">Días sin consumo</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{diasConConsumo}</p>
            <p className="text-xs text-red-500 mt-1">Días con consumo</p>
          </div>
        </div>

        {/* Mini calendario del mes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900 mb-3 text-sm">
            {format(new Date(), "MMMM yyyy", { locale: es })}
          </h2>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['D','L','M','X','J','V','S'].map(d => (
              <div key={d} className="text-xs text-slate-400 font-medium pb-1">{d}</div>
            ))}
            {/* Desplazamiento del primer día */}
            {Array.from({ length: diasMes[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {diasMes.map(day => {
              const entry = entries.find(e => isSameDay(new Date(e.fecha), day));
              return (
                <div key={day.toISOString()}
                  className={clsx(
                    'flex flex-col items-center py-1 rounded-lg text-xs',
                    isToday(day) && 'bg-blue-50 font-bold text-blue-700',
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  <CalendarDot hasEntry={!!entry} huboConsumo={entry?.huboConsumo} />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 justify-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Sin consumo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Con consumo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
