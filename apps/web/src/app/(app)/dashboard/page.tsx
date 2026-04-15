'use client';
// ═══════════════════════════════════════════════════════════
// DASHBOARD — /dashboard
// KPIs del día · Agenda resumen · Acciones rápidas
// ═══════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  Calendar, Users, Receipt, FlaskConical, TrendingUp,
  Clock, CheckCircle, XCircle, AlertTriangle, Video,
  ArrowRight, Plus,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { adminApi, appointmentsApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { clsx } from 'clsx';

const hoy = format(new Date(), 'yyyy-MM-dd');

function StatCard({
  label, value, icon: Icon, color = 'blue', sub,
}: {
  label: string; value: string | number; icon: any; color?: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', colors[color])}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function AppointmentRow({ cita }: { cita: any }) {
  const estadoConfig: Record<string, { label: string; color: string }> = {
    PROGRAMADA:   { label: 'Programada',   color: 'bg-slate-100 text-slate-600' },
    CONFIRMADA:   { label: 'Confirmada',   color: 'bg-blue-100 text-blue-700' },
    EN_ESPERA:    { label: 'En espera',    color: 'bg-yellow-100 text-yellow-700' },
    EN_CONSULTA:  { label: 'En consulta',  color: 'bg-green-100 text-green-700' },
    COMPLETADA:   { label: 'Completada',   color: 'bg-emerald-100 text-emerald-700' },
    CANCELADA:    { label: 'Cancelada',    color: 'bg-red-100 text-red-600' },
    NO_SHOW:      { label: 'No asistió',   color: 'bg-orange-100 text-orange-600' },
  };
  const cfg = estadoConfig[cita.estado] ?? { label: cita.estado, color: 'bg-slate-100 text-slate-600' };
  const hora = format(new Date(cita.fechaInicio), 'HH:mm');

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors group">
      <span className="text-sm font-mono text-slate-500 w-12 shrink-0">{hora}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {cita.paciente?.nombre} {cita.paciente?.apellidoPaterno}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {cita.medico?.usuario?.nombre} · {cita.tipoCita?.replace(/_/g, ' ')}
          {cita.esTelemedicina && ' 🎥'}
        </p>
      </div>
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', cfg.color)}>
        {cfg.label}
      </span>
      <Link
        href={`/agenda?citaId=${cita.id}`}
        className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 shrink-0"
      >
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const desde = format(new Date(), 'yyyy-MM-01');
      const hasta = format(new Date(), 'yyyy-MM-dd');
      const { data } = await adminApi.getOperational?.({ desde, hasta }) ??
        { data: { citas: {}, pacientes: {}, financiero: {}, adicciones: {} } };
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: citasHoy } = useQuery({
    queryKey: ['citas-hoy'],
    queryFn: async () => {
      const { data } = await appointmentsApi.findAll({ fecha: hoy, limit: 20 });
      return data;
    },
    refetchInterval: 30000,
  });

  const saludo = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {saludo()}, {user?.nombre} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/pacientes/nuevo" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
              <Plus size={14} /> Nuevo paciente
            </Link>
            <Link href="/agenda/nueva-cita" className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <Calendar size={14} /> Agendar cita
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Citas hoy"
            value={citasHoy?.meta?.total ?? '–'}
            icon={Calendar}
            color="blue"
          />
          <StatCard
            label="Completadas"
            value={kpis?.citas?.completadas ?? '–'}
            icon={CheckCircle}
            color="green"
            sub={`${kpis?.citas?.tasaCompletadas ?? '–'} este mes`}
          />
          <StatCard
            label="No asistieron"
            value={kpis?.citas?.noShow ?? '–'}
            icon={XCircle}
            color="red"
            sub={`${kpis?.citas?.tasaNoShow ?? '–'} este mes`}
          />
          <StatCard
            label="Facturado"
            value={kpis?.financiero?.totalFacturado ? `$${Number(kpis.financiero.totalFacturado).toLocaleString()}` : '–'}
            icon={Receipt}
            color="purple"
            sub="Este mes"
          />
          <StatCard
            label="Pacientes (mes)"
            value={kpis?.pacientes?.nuevos ?? '–'}
            icon={Users}
            color="yellow"
            sub="Nuevos registros"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agenda del día */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Agenda de hoy</h2>
              <Link href="/agenda" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                Ver agenda completa <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {!citasHoy?.data?.length ? (
                <div className="p-8 text-center text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin citas programadas para hoy</p>
                </div>
              ) : (
                citasHoy.data.map((cita: any) => (
                  <AppointmentRow key={cita.id} cita={cita} />
                ))
              )}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Accesos rápidos</h2>
              <div className="space-y-2">
                {[
                  { href: '/agenda/nueva-cita', icon: Calendar, label: 'Nueva cita', color: 'text-blue-600' },
                  { href: '/pacientes/nuevo', icon: Users, label: 'Nuevo paciente', color: 'text-green-600' },
                  { href: '/laboratorio/nueva-orden', icon: FlaskConical, label: 'Orden de lab', color: 'text-purple-600' },
                  { href: '/facturacion/nueva', icon: Receipt, label: 'Nueva factura', color: 'text-orange-600' },
                  { href: '/reportes/conadic', icon: TrendingUp, label: 'Reporte CONADIC', color: 'text-red-600' },
                ].map(({ href, icon: Icon, label, color }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors group"
                  >
                    <Icon size={15} className={clsx(color, 'shrink-0')} />
                    {label}
                    <ArrowRight size={12} className="ml-auto text-slate-300 group-hover:text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Telemedicina pendiente */}
            {citasHoy?.data?.some((c: any) => c.esTelemedicina && ['CONFIRMADA','EN_ESPERA'].includes(c.estado)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Video size={15} className="text-blue-600" />
                  <h3 className="font-medium text-blue-900 text-sm">Videoconsultas hoy</h3>
                </div>
                {citasHoy.data
                  .filter((c: any) => c.esTelemedicina && ['CONFIRMADA','EN_ESPERA'].includes(c.estado))
                  .map((c: any) => (
                    <div key={c.id} className="text-xs text-blue-700 flex items-center justify-between mt-1">
                      <span>{format(new Date(c.fechaInicio), 'HH:mm')} — {c.paciente?.nombre}</span>
                      <Link href={c.dailyRoomUrl ?? '#'} target="_blank"
                        className="bg-blue-600 text-white px-2 py-0.5 rounded font-medium hover:bg-blue-700">
                        Entrar
                      </Link>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
