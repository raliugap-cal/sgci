'use client';
// ═══════════════════════════════════════════════════════════
// ADICCIONES — /adicciones (staff)
// NOM-028-SSA2 · Expedientes · PTI · Instrumentos · Dashboard
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Heart, Plus, Search, TrendingUp, TrendingDown,
  ChevronRight, ClipboardList, User, Calendar,
  CheckCircle, AlertCircle, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import { addictionsApi, patientsApi } from '../../../lib/api';
import { clsx } from 'clsx';

const ESTADO_COLOR: Record<string, string> = {
  EN_EVALUACION:    'bg-blue-100 text-blue-700',
  EN_TRATAMIENTO:   'bg-green-100 text-green-700',
  SUSPENSION_TEMPORAL: 'bg-yellow-100 text-yellow-700',
  ALTA_TERAPEUTICA: 'bg-emerald-100 text-emerald-700',
  ALTA_VOLUNTARIA:  'bg-slate-100 text-slate-600',
  CANALIZADO:       'bg-purple-100 text-purple-700',
  ABANDONO:         'bg-red-100 text-red-600',
};

const INSTRUMENTOS_COMUNES = ['AUDIT', 'DAST-10', 'CAGE'];

// ─── Dashboard de evolución de un expediente ──────────────
function ExpedienteDashboard({ expedienteId }: { expedienteId: string }) {
  const { data } = useQuery({
    queryKey: ['adicciones-dashboard', expedienteId],
    queryFn: async () => {
      const { data } = await addictionsApi.getDashboard(expedienteId);
      return data;
    },
  });

  if (!data) return <div className="p-4 text-center text-slate-400 text-sm">Cargando...</div>;

  const maxDias = Math.max(data.diasSinConsumo + data.diasConConsumo, 1);
  const pctSin = Math.round((data.diasSinConsumo / maxDias) * 100);

  return (
    <div className="space-y-4 p-4">
      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <TrendingDown size={16} className="text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700">{data.diasSinConsumo}</p>
          <p className="text-xs text-green-600">Días sin consumo</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <AlertCircle size={16} className="text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-600">{data.diasConConsumo}</p>
          <p className="text-xs text-red-500">Días con consumo</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <ClipboardList size={16} className="text-blue-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{data.totalSesiones}</p>
          <p className="text-xs text-blue-600">Sesiones totales</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Días sin consumo registrados</span>
          <span>{pctSin}%</span>
        </div>
        <div className="w-full bg-red-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all duration-700"
            style={{ width: `${pctSin}%` }} />
        </div>
      </div>

      {/* Estado de ánimo promedio */}
      {data.estadoAnimoPromedio > 0 && (
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Estado de ánimo promedio (diario)</span>
            <span className={clsx(
              'text-lg font-bold',
              data.estadoAnimoPromedio >= 7 ? 'text-green-600' :
              data.estadoAnimoPromedio >= 4 ? 'text-amber-600' : 'text-red-600',
            )}>
              {data.estadoAnimoPromedio.toFixed(1)}/10
            </span>
          </div>
        </div>
      )}

      {/* Instrumentos aplicados */}
      {data.instrumentos?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Instrumentos aplicados</h4>
          <div className="space-y-2">
            {data.instrumentos.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-slate-800">{i.instrumento?.nombre}</span>
                  <span className="text-slate-400 text-xs ml-2">
                    {format(new Date(i.aplicadoAt), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">{i.puntaje} pts</span>
                  <p className="text-xs text-slate-500 max-w-32 truncate">{i.interpretacion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas entradas del diario */}
      {data.diario?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Diario reciente (30 días)</h4>
          <div className="flex gap-1 flex-wrap">
            {data.diario.slice(0, 30).map((d: any) => (
              <div key={d.id}
                className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                  d.huboConsumo ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700',
                )}
                title={`${format(new Date(d.fecha), "d MMM")} — ${d.huboConsumo ? 'Consumo' : 'Sin consumo'}`}
              >
                {format(new Date(d.fecha), 'd')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formulario de aplicación de instrumento ──────────────
function InstrumentoForm({ expedienteId, onDone }: { expedienteId: string; onDone: () => void }) {
  const [instrumentoId, setInstrumentoId] = useState('');
  const [respuestas, setRespuestas] = useState<number[]>([]);
  const qc = useQueryClient();

  const { data: instrumentos } = useQuery({
    queryKey: ['instrumentos'],
    queryFn: async () => { const { data } = await addictionsApi.getInstruments(); return data; },
  });

  const instrumento = instrumentos?.find((i: any) => i.id === instrumentoId);
  const preguntas: any[] = instrumento?.preguntas ?? [];

  const applyMutation = useMutation({
    mutationFn: () => addictionsApi.applyInstrument({ expedienteAdiccionId: expedienteId, instrumentoId, respuestas }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adicciones-dashboard'] }); onDone(); },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Instrumento</label>
        <select value={instrumentoId} onChange={e => { setInstrumentoId(e.target.value); setRespuestas([]); }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="">Seleccionar instrumento...</option>
          {instrumentos?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre} — {i.descripcion}</option>)}
        </select>
      </div>

      {instrumento && (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {preguntas.map((p, idx) => (
            <div key={p.id}>
              <p className="text-sm font-medium text-slate-800 mb-2">
                {idx + 1}. {p.texto}
              </p>
              <div className="space-y-1">
                {p.opciones?.map((o: any) => (
                  <label key={o.valor} className={clsx(
                    'flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors text-sm',
                    respuestas[idx] === o.valor ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-slate-100 hover:bg-slate-50',
                  )}>
                    <input type="radio" name={`q${idx}`} value={o.valor}
                      checked={respuestas[idx] === o.valor}
                      onChange={() => {
                        const r = [...respuestas];
                        r[idx] = o.valor;
                        setRespuestas(r);
                      }} className="shrink-0" />
                    {o.texto}
                    <span className="ml-auto text-slate-400 text-xs">{o.puntaje} pts</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {instrumento && (
        <button
          onClick={() => applyMutation.mutate()}
          disabled={respuestas.filter(r => r !== undefined).length < preguntas.length || applyMutation.isPending}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
        >
          {applyMutation.isPending ? 'Aplicando...' : 'Calcular e guardar resultado'}
        </button>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────
export default function AdiccionesPage() {
  const qc = useQueryClient();
  const [selectedExp, setSelectedExp] = useState<any>(null);
  const [tab, setTab] = useState<'dashboard' | 'sesion' | 'instrumento'>('dashboard');
  const [busqueda, setBusqueda] = useState('');

  // Buscar pacientes para seleccionar
  const { data: pacientes } = useQuery({
    queryKey: ['search-pac', busqueda],
    queryFn: async () => {
      const { data } = await patientsApi.search({ q: busqueda, limit: 8 });
      return data?.data?.filter((p: any) => p.tieneExpedienteAdicciones);
    },
    enabled: busqueda.length >= 2,
  });

  // Cargar expediente al seleccionar paciente
  const loadExpedienteMutation = useMutation({
    mutationFn: async (paciente: any) => {
      // En producción: GET /addictions/expedientes?pacienteId=X
      // Por ahora usamos un placeholder
      return { id: `exp-${paciente.id}`, paciente, estadoTratamiento: 'EN_TRATAMIENTO' };
    },
    onSuccess: (data) => setSelectedExp(data),
  });

  // Nueva sesión
  const sesionForm = useForm();
  const sesionMutation = useMutation({
    mutationFn: (d: any) => addictionsApi.createSession({ ...d, expedienteAdiccionId: selectedExp?.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adicciones-dashboard'] }); sesionForm.reset(); },
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Adicciones</h1>
            <p className="text-slate-500 text-sm">Expedientes NOM-028-SSA2</p>
          </div>
          <Link href="/adicciones/nuevo-expediente"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus size={14} /> Nuevo expediente
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Panel izquierdo: buscar paciente */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <Search size={13} className="text-slate-400" />
                <input type="text" placeholder="Buscar paciente..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="bg-transparent text-sm outline-none flex-1" />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {busqueda.length >= 2 && !pacientes?.length && (
                <p className="text-slate-400 text-sm p-4 text-center">
                  Sin pacientes con expediente de adicciones
                </p>
              )}
              {pacientes?.map((p: any) => (
                <button key={p.id} onClick={() => loadExpedienteMutation.mutate(p)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 text-left hover:bg-slate-50 transition-colors',
                    selectedExp?.paciente?.id === p.id && 'bg-blue-50',
                  )}>
                  <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {p.nombre[0]}{p.apellidoPaterno[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {p.apellidoPaterno} {p.nombre}
                    </p>
                    <p className="text-xs text-slate-500">{p.numeroExpediente}</p>
                  </div>
                  <ChevronRight size={13} className="text-slate-300 shrink-0" />
                </button>
              ))}

              {!busqueda && (
                <div className="p-6 text-center text-slate-400">
                  <Heart size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Busque un paciente para ver su expediente de adicciones</p>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: detalle del expediente */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {!selectedExp ? (
              <div className="flex items-center justify-center h-full min-h-64">
                <div className="text-center text-slate-400">
                  <Heart size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Seleccione un paciente para ver su expediente</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Header del expediente */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      {selectedExp.paciente?.apellidoPaterno} {selectedExp.paciente?.nombre}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_COLOR[selectedExp.estadoTratamiento] ?? 'bg-slate-100 text-slate-600')}>
                        {selectedExp.estadoTratamiento?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <Link href={`/adicciones/${selectedExp.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    Ver expediente completo →
                  </Link>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-50 p-1 border-b border-slate-100">
                  {([
                    ['dashboard', 'Dashboard', BarChart2],
                    ['instrumento', 'Aplicar instrumento', ClipboardList],
                    ['sesion', 'Registrar sesión', Calendar],
                  ] as const).map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setTab(id)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 justify-center transition-colors',
                        tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                      )}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                {/* Dashboard */}
                {tab === 'dashboard' && <ExpedienteDashboard expedienteId={selectedExp.id} />}

                {/* Aplicar instrumento */}
                {tab === 'instrumento' && (
                  <div className="p-4">
                    <InstrumentoForm expedienteId={selectedExp.id} onDone={() => setTab('dashboard')} />
                  </div>
                )}

                {/* Registrar sesión */}
                {tab === 'sesion' && (
                  <div className="p-4">
                    <form onSubmit={sesionForm.handleSubmit(d => sesionMutation.mutate(d))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de sesión</label>
                          <select {...sesionForm.register('tipoSesion')}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                            <option value="individual">Individual</option>
                            <option value="grupal">Grupal</option>
                            <option value="familiar">Familiar</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">¿Hubo consumo?</label>
                          <select {...sesionForm.register('huboConsumo')}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                            <option value="">No reportado</option>
                            <option value="false">No</option>
                            <option value="true">Sí</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Objetivos de la sesión</label>
                        <input {...sesionForm.register('objetivosSesion', { required: true })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          placeholder="Ej: Revisar estrategias de afrontamiento..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Contenido de la sesión</label>
                        <textarea {...sesionForm.register('contenido', { required: true })} rows={4}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                          placeholder="Descripción detallada del desarrollo de la sesión..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Logros</label>
                          <textarea {...sesionForm.register('logros')} rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                            placeholder="Avances observados..." />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Tareas para el paciente</label>
                          <textarea {...sesionForm.register('tareas')} rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                            placeholder="Compromisos para la próxima sesión..." />
                        </div>
                      </div>
                      <button type="submit" disabled={sesionMutation.isPending}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                        {sesionMutation.isPending ? 'Guardando...' : '✓ Guardar nota de sesión'}
                      </button>
                      {sesionMutation.isSuccess && (
                        <div className="flex items-center gap-2 text-emerald-600 text-sm">
                          <CheckCircle size={14} /> Sesión registrada exitosamente
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
