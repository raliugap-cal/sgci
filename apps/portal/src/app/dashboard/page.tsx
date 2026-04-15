'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL PACIENTE — DASHBOARD /dashboard
// Datos offline-first desde IndexedDB + sync automático
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar, Stethoscope, Pill, FlaskConical, MessageSquare,
  Heart, Wifi, WifiOff, RefreshCw, AlertCircle, ChevronRight,
  Clock, CheckCircle, Video,
} from 'lucide-react';
import { useSync } from '../../lib/sync';
import { getAll, getMeta } from '../../lib/offline-store';
import { clsx } from 'clsx';

function OfflineIndicator({ online, syncing, pendingCount, onSync }: any) {
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
      online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
    )}>
      {online ? <Wifi size={11} /> : <WifiOff size={11} />}
      <span>{online ? 'En línea' : 'Sin conexión'}</span>
      {pendingCount > 0 && (
        <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-xs">
          {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
        </span>
      )}
      {online && (
        <button onClick={onSync} disabled={syncing} className="ml-1">
          <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}

function NextAppointmentCard({ cita }: { cita: any }) {
  const fecha = new Date(cita.fechaInicio);
  const dias = differenceInDays(fecha, new Date());
  return (
    <div className="bg-blue-600 text-white rounded-2xl p-5">
      <p className="text-blue-200 text-xs font-medium mb-1">
        {dias === 0 ? 'HOY' : dias === 1 ? 'MAÑANA' : `EN ${dias} DÍAS`}
      </p>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-lg leading-tight">
            {format(fecha, "d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-blue-200 text-sm">{format(fecha, 'HH:mm')} hrs</p>
          <p className="text-white text-sm mt-2">
            Dr(a). {cita.medico?.usuario?.nombre} {cita.medico?.usuario?.apellidoPaterno}
          </p>
          <p className="text-blue-200 text-xs">{cita.sede?.nombre}</p>
        </div>
        <div className="text-right">
          {cita.esTelemedicina ? (
            <div className="bg-white/20 rounded-xl p-3">
              <Video size={24} className="text-white" />
            </div>
          ) : (
            <div className="bg-white/20 rounded-xl p-3">
              <Stethoscope size={24} className="text-white" />
            </div>
          )}
        </div>
      </div>
      {cita.esTelemedicina && cita.dailyRoomUrl && (
        <a
          href={cita.dailyRoomUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 w-full bg-white text-blue-600 rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Video size={14} /> Entrar a videoconsulta
        </a>
      )}
    </div>
  );
}

function QuickNav() {
  const navs = [
    { href: '/citas',      icon: Calendar,     label: 'Mis citas',      color: 'bg-blue-50 text-blue-600' },
    { href: '/mi-salud',   icon: Stethoscope,  label: 'Mi salud',       color: 'bg-emerald-50 text-emerald-600' },
    { href: '/recetas',    icon: Pill,         label: 'Recetas',        color: 'bg-purple-50 text-purple-600' },
    { href: '/resultados', icon: FlaskConical, label: 'Resultados',     color: 'bg-amber-50 text-amber-600' },
    { href: '/diario',     icon: Heart,        label: 'Mi diario',      color: 'bg-red-50 text-red-600' },
    { href: '/mensajes',   icon: MessageSquare,label: 'Mensajes',       color: 'bg-slate-50 text-slate-600' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {navs.map(({ href, icon: Icon, label, color }) => (
        <Link key={href} href={href}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 hover:shadow-sm transition-shadow"
        >
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', color)}>
            <Icon size={20} />
          </div>
          <span className="text-xs font-medium text-slate-700 text-center leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export default function PortalDashboard() {
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [citas, setCitas] = useState<any[]>([]);
  const [pendingDiary, setPendingDiary] = useState(0);
  const [loading, setLoading] = useState(true);

  const { online, syncing, lastSync, pendingCount, sync } = useSync(pacienteId);

  useEffect(() => {
    const id = localStorage.getItem('portal_paciente_id');
    const n = localStorage.getItem('portal_nombre');
    if (id) setPacienteId(id);
    if (n) setNombre(n);
  }, []);

  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    const [allCitas] = await Promise.all([
      getAll<any>('appointments'),
    ]);
    // Filtrar citas futuras
    const futuras = allCitas
      .filter(c => isFuture(new Date(c.fechaInicio)) && !['CANCELADA', 'NO_SHOW'].includes(c.estado))
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
    setCitas(futuras);
    setLoading(false);
  };

  // Recargar al terminar sync
  useEffect(() => {
    if (!syncing) loadLocalData();
  }, [syncing]);

  const proximaCita = citas[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Bienvenido</p>
          <h1 className="font-bold text-slate-900 text-lg">{nombre || 'Mi portal'}</h1>
        </div>
        <OfflineIndicator online={online} syncing={syncing} pendingCount={pendingCount} onSync={sync} />
      </div>

      <div className="px-4 py-5 space-y-5 max-w-md mx-auto">

        {/* Banner offline cuando hay datos sin enviar */}
        {pendingCount > 0 && !online && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {pendingCount} registro{pendingCount > 1 ? 's' : ''} esperando sincronización
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Se enviarán automáticamente cuando recupere conexión
              </p>
            </div>
          </div>
        )}

        {/* Próxima cita */}
        {loading ? (
          <div className="bg-slate-200 rounded-2xl h-40 animate-pulse" />
        ) : proximaCita ? (
          <NextAppointmentCard cita={proximaCita} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <Calendar size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Sin citas próximas</p>
            <p className="text-slate-400 text-xs mt-1">Contacte a la clínica para agendar</p>
          </div>
        )}

        {/* Accesos rápidos */}
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Accesos rápidos</h2>
          <QuickNav />
        </div>

        {/* Resumen de citas */}
        {citas.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Próximas citas</h2>
              <Link href="/citas" className="text-xs text-blue-600">Ver todas</Link>
            </div>
            {citas.slice(1, 4).map((cita) => (
              <div key={cita.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  {cita.esTelemedicina ? <Video size={16} className="text-blue-600" /> : <Calendar size={16} className="text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {format(new Date(cita.fechaInicio), "d 'de' MMMM, HH:mm", { locale: es })}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {cita.medico?.usuario?.nombre} {cita.medico?.usuario?.apellidoPaterno}
                  </p>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Último sync */}
        {lastSync && (
          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <CheckCircle size={10} className="text-green-500" />
            Última sincronización: {format(lastSync, "HH:mm", { locale: es })}
          </p>
        )}
      </div>
    </div>
  );
}
