'use client';
// ═══════════════════════════════════════════════════════════
// REPORTES — /reportes
// KPIs operativos · CONADIC · Contabilidad · Corte de caja
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import {
  BarChart2, TrendingUp, FileText, Download,
  Calendar, Users, Receipt, Activity,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import { reportsApi } from '../../../lib/api';
import { clsx } from 'clsx';

const anioActual = new Date().getFullYear();
const mesActual = startOfMonth(new Date());

function KpiCard({ label, value, sub, icon: Icon, color }: any) {
  const clrs: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', clrs[color] ?? clrs.blue)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value ?? '–'}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportesPage() {
  const [tab, setTab] = useState<'operativo' | 'conadic' | 'contable'>('operativo');
  const [desde, setDesde] = useState(format(mesActual, 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [trimestre, setTrimestre] = useState<1|2|3|4>(Math.ceil((new Date().getMonth() + 1) / 3) as 1|2|3|4);

  const { data: kpis } = useQuery({
    queryKey: ['kpis', desde, hasta],
    queryFn: async () => {
      const { data } = await reportsApi.getOperational({ desde, hasta });
      return data;
    },
    enabled: tab === 'operativo',
  });

  const { data: conadic } = useQuery({
    queryKey: ['conadic', anioActual, trimestre],
    queryFn: async () => {
      const { data } = await reportsApi.getConadic(anioActual, trimestre);
      return data;
    },
    enabled: tab === 'conadic',
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reportes</h1>
          <p className="text-slate-500 text-sm">Indicadores operativos · CONADIC · Contabilidad</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([
            ['operativo', 'KPIs Operativos', BarChart2],
            ['conadic',   'CONADIC NOM-028', FileText],
            ['contable',  'Contabilidad',    Receipt],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Filtro de fechas */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          {tab !== 'conadic' ? (
            <>
              <Calendar size={14} className="text-slate-400" />
              <span className="text-sm text-slate-600">Período:</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="text-sm border border-slate-200 rounded px-2 py-1" />
              <span className="text-slate-400">—</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="text-sm border border-slate-200 rounded px-2 py-1" />
            </>
          ) : (
            <>
              <Calendar size={14} className="text-slate-400" />
              <span className="text-sm text-slate-600">Trimestre:</span>
              {([1,2,3,4] as const).map(t => (
                <button key={t} onClick={() => setTrimestre(t)}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-sm font-medium border transition-colors',
                    trimestre === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  T{t} {anioActual}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Tab: Operativo */}
        {tab === 'operativo' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Citas totales" value={kpis?.citas?.total} icon={Calendar} color="blue" />
              <KpiCard label="Completadas" value={kpis?.citas?.completadas}
                sub={kpis?.citas?.tasaCompletadas} icon={Activity} color="green" />
              <KpiCard label="No asistieron" value={kpis?.citas?.noShow}
                sub={kpis?.citas?.tasaNoShow} icon={Users} color="red" />
              <KpiCard label="Telemedicina" value={kpis?.citas?.telemedicina} icon={Activity} color="purple" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Facturado" value={kpis?.financiero?.totalFacturado ? `$${Number(kpis.financiero.totalFacturado).toLocaleString()}` : '–'} icon={Receipt} color="green" sub="En el período" />
              <KpiCard label="Cobrado" value={kpis?.financiero?.totalCobrado ? `$${Number(kpis.financiero.totalCobrado).toLocaleString()}` : '–'} icon={TrendingUp} color="blue" />
              <KpiCard label="Saldo pendiente" value={kpis?.financiero?.saldo ? `$${Number(kpis.financiero.saldo).toLocaleString()}` : '–'} icon={Receipt} color="amber" />
              <KpiCard label="Pacientes nuevos" value={kpis?.pacientes?.nuevos} icon={Users} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900 mb-4">Distribución de citas</h2>
                {kpis?.citas ? (
                  <div className="space-y-2">
                    {[
                      { label: 'Completadas', value: kpis.citas.completadas, total: kpis.citas.total, color: 'bg-emerald-500' },
                      { label: 'En espera / En consulta', value: (kpis.citas.total - kpis.citas.completadas - kpis.citas.canceladas - kpis.citas.noShow), total: kpis.citas.total, color: 'bg-blue-500' },
                      { label: 'Canceladas', value: kpis.citas.canceladas, total: kpis.citas.total, color: 'bg-slate-400' },
                      { label: 'No asistieron', value: kpis.citas.noShow, total: kpis.citas.total, color: 'bg-red-500' },
                    ].map(({ label, value, total, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>{label}</span>
                          <span className="font-medium">{value} ({total > 0 ? Math.round(value/total*100) : 0}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={clsx('h-2 rounded-full', color)}
                            style={{ width: `${total > 0 ? (value/total*100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Sin datos para el período seleccionado</p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900 mb-4">Expedientes de adicciones</h2>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-amber-600">{kpis?.adicciones?.expedientesActivos ?? '–'}</p>
                  <p className="text-sm text-slate-500 mt-1">Pacientes en tratamiento activo</p>
                </div>
                <a href="/reportes/conadic" className="block mt-3 text-center text-sm text-blue-600 hover:text-blue-800">
                  Ver reporte CONADIC completo →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab: CONADIC */}
        {tab === 'conadic' && conadic && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Nota:</strong> {conadic.metadata?.nota}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="En tratamiento" value={conadic.resumen?.totalEnTratamiento} icon={Users} color="blue" />
              <KpiCard label="Ingresos período" value={conadic.resumen?.ingresos} icon={TrendingUp} color="green" />
              <KpiCard label="Egresos período" value={conadic.resumen?.egresos} icon={Activity} color="amber" />
              <KpiCard label="Continuación" value={conadic.resumen?.continuacion} icon={Calendar} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { title: 'Por sustancia principal', data: conadic.distribucionSustancia },
                { title: 'Por modalidad', data: conadic.distribucionModalidad },
                { title: 'Por estado tratamiento', data: conadic.distribucionEstado },
              ].map(({ title, data }) => (
                <div key={title} className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="font-medium text-slate-900 text-sm mb-3">{title}</h3>
                  {data && Object.entries(data).map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="font-bold text-slate-900">{String(count)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Download size={14} /> Exportar para CONADIC
              </button>
            </div>
          </div>
        )}

        {/* Tab: Contabilidad */}
        {tab === 'contable' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Exportación contable</h2>
            <p className="text-slate-500 text-sm">
              Mientras QuickBooks Online está en proceso de activación, puede exportar la información contable
              en los siguientes formatos para su contador o para importación manual.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <strong>QuickBooks Online:</strong> El módulo de sincronización está construido y listo.
              Active <code className="bg-blue-100 px-1 rounded">QB_SYNC_ENABLED=true</code> en las variables
              de entorno cuando tenga las credenciales OAuth2.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Excel QB compatible', desc: 'Columnas listas para importar en QuickBooks Desktop', fmt: 'xlsx', icon: '📊' },
                { label: 'CSV QuickBooks Online', desc: 'Formato nativo de importación CSV de QBO', fmt: 'csv_qbo', icon: '📋' },
                { label: 'ZIP XMLs CFDI', desc: 'Todos los archivos XML del SAT del período', fmt: 'zip', icon: '🗜️' },
              ].map(({ label, desc, fmt, icon }) => (
                <div key={fmt} className="border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2">{icon}</div>
                  <h3 className="font-medium text-slate-900 text-sm mb-1">{label}</h3>
                  <p className="text-xs text-slate-500 mb-3">{desc}</p>
                  <a href={`/api/v1/reports/accounting?desde=${desde}&hasta=${hasta}&formato=${fmt}`}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800">
                    <Download size={11} /> Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
