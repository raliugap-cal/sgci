'use client';
// ═══════════════════════════════════════════════════════════
// EXPEDIENTE ADICCIONES — /adicciones/[id]
// Detalle completo NOM-028: datos, PTI, sesiones, diario
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Heart, ClipboardList, Calendar, TrendingUp,
  CheckCircle, AlertCircle, FileText, Plus, User,
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import { addictionsApi } from '../../../../lib/api';
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

export default function ExpedienteAdiccionPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'pti' | 'sesiones' | 'dashboard'>('overview');

  const { data: expediente, isLoading } = useQuery({
    queryKey: ['expediente-adiccion', id],
    queryFn: async () => {
      const { data } = await addictionsApi.getExpediente(id);
      return data;
    },
  });

  const { data: dashboard } = useQuery({
    queryKey: ['adicciones-dashboard', id],
    queryFn: async () => {
      const { data } = await addictionsApi.getDashboard(id);
      return data;
    },
    enabled: activeTab === 'dashboard',
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!expediente) return null;

  const p = expediente.paciente;
  const planActivo = expediente.planesT?.[0];
  const tabs = [
    ['overview', 'Resumen', FileText],
    ['pti', 'Plan PTI', ClipboardList],
    ['sesiones', 'Sesiones', Calendar],
    ['dashboard', 'Evolución', TrendingUp],
  ] as const;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/adicciones" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 mt-0.5 shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0">
                {p.nombre?.[0]}{p.apellidoPaterno?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">
                    {p.apellidoPaterno} {p.apellidoMaterno}, {p.nombre}
                  </h1>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                    ESTADO_COLOR[expediente.estadoTratamiento] ?? 'bg-slate-100 text-slate-600')}>
                    {expediente.estadoTratamiento?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {p.numeroExpediente} · Ingreso: {format(new Date(expediente.fechaIngreso), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Link href={`/pacientes/${p.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                  <User size={13} /> Ver expediente general
                </Link>
                <Link href={`/adicciones/${id}/nueva-sesion`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={13} /> Nueva sesión
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Info básica NOM-028 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Sustancia principal', value: expediente.sustanciaPrincipal },
            { label: 'Modalidad', value: expediente.modalidad?.replace(/_/g, ' ') },
            { label: 'Médico responsable', value: `Dr(a). ${expediente.medicoResponsable?.usuario?.nombre}` },
            { label: 'Patrón de consumo', value: expediente.patronConsumo ?? 'No especificado' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(([tabId, label, Icon]) => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-colors',
                activeTab === tabId ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab: Resumen */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Heart size={14} className="text-red-400" /> Perfil de consumo
              </h3>
              {[
                { label: 'Sustancia principal', value: expediente.sustanciaPrincipal },
                { label: 'Sustancias secundarias', value: expediente.sustanciasSecundarias?.join(', ') || '—' },
                { label: 'Edad de inicio', value: expediente.edadInicio ? `${expediente.edadInicio} años` : '—' },
                { label: 'Patrón de consumo', value: expediente.patronConsumo ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-36 shrink-0">{label}</span>
                  <span className="text-slate-900 font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList size={14} className="text-blue-400" /> Instrumentos aplicados
              </h3>
              {!expediente.instrumentos?.length ? (
                <p className="text-slate-400 text-sm">Sin instrumentos aplicados</p>
              ) : (
                expediente.instrumentos.slice(0, 5).map((instr: any) => (
                  <div key={instr.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{instr.instrumento?.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(instr.aplicadoAt), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{instr.puntaje} pts</p>
                      <p className="text-xs text-slate-500 max-w-28 text-right truncate">{instr.interpretacion}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 lg:col-span-2">
              <h3 className="font-semibold text-slate-900">Historia social y red de apoyo</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Historia social</p>
                  <p className="text-slate-700">{expediente.historiaSocial ?? 'Sin registrar'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Red de apoyo</p>
                  <p className="text-slate-700">{expediente.redApoyo ?? 'Sin registrar'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Plan PTI */}
        {activeTab === 'pti' && (
          <div className="space-y-4">
            {!planActivo ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 mb-3">Sin Plan de Tratamiento Individual activo</p>
                <Link href={`/adicciones/${id}/nuevo-pti`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2">
                  <Plus size={13} /> Elaborar PTI
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">PTI versión {planActivo.version}</h3>
                    <p className="text-sm text-slate-500">
                      Desde {format(new Date(planActivo.fechaInicio), "d 'de' MMMM 'de' yyyy", { locale: es })} ·
                      Revisión: {format(new Date(planActivo.fechaRevision), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    {planActivo.estado}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Objetivo general</p>
                  <p className="text-sm text-slate-800">{planActivo.objetivoGeneral}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Objetivos específicos</p>
                  <ul className="space-y-1">
                    {planActivo.objetivosEspecificos?.map((obj: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Sesiones médico/sem', value: planActivo.sesionesSemMedico },
                    { label: 'Sesiones psico/sem', value: planActivo.sesionesSemPsico },
                    { label: 'Sesiones grupales/sem', value: planActivo.sesionesSemGrupal },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-blue-600">{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Sesiones */}
        {activeTab === 'sesiones' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Notas de sesión</h3>
              <Link href={`/adicciones/${id}/nueva-sesion`}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                <Plus size={11} /> Nueva
              </Link>
            </div>
            {!expediente.notasSesion?.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">Sin sesiones registradas</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {expediente.notasSesion.map((sesion: any) => (
                  <div key={sesion.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 capitalize">
                            {sesion.tipoSesion} — {format(new Date(sesion.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                          </span>
                          {sesion.huboConsumo && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              Reportó consumo
                            </span>
                          )}
                          {sesion.firmada && (
                            <CheckCircle size={12} className="text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Objetivos: {sesion.objetivosSesion}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">{sesion.contenido}</p>
                    {sesion.logros && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle size={10} /> {sesion.logros}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Dashboard de evolución */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-700">{dashboard.diasSinConsumo}</p>
                <p className="text-xs text-green-600 mt-1">Días sin consumo</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{dashboard.diasConConsumo}</p>
                <p className="text-xs text-red-500 mt-1">Días con consumo</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-700">{dashboard.totalSesiones}</p>
                <p className="text-xs text-blue-600 mt-1">Sesiones totales</p>
              </div>
            </div>

            {dashboard.diasSinConsumo + dashboard.diasConConsumo > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Progreso — días registrados</h3>
                <div className="w-full bg-red-100 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(dashboard.diasSinConsumo / (dashboard.diasSinConsumo + dashboard.diasConConsumo) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0 días</span>
                  <span className="text-green-600 font-medium">
                    {Math.round(dashboard.diasSinConsumo / (dashboard.diasSinConsumo + dashboard.diasConConsumo) * 100)}% sin consumo
                  </span>
                  <span>{dashboard.diasSinConsumo + dashboard.diasConConsumo} días totales</span>
                </div>
              </div>
            )}

            {/* Diario visual */}
            {dashboard.diario?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Diario de consumo (últimos 30 días)</h3>
                <div className="flex flex-wrap gap-1">
                  {dashboard.diario.map((d: any) => (
                    <div key={d.id}
                      className={clsx(
                        'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold cursor-help',
                        d.huboConsumo ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700',
                      )}
                      title={`${format(new Date(d.fecha), 'd MMM', { locale: es })} — ${d.huboConsumo ? 'Consumo' : 'Sin consumo'}`}>
                      {format(new Date(d.fecha), 'd')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
