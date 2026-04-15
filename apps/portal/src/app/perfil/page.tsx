'use client';
// ═══════════════════════════════════════════════════════════
// PORTAL — PERFIL /perfil
// Datos del paciente · Preferencias · Cerrar sesión
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Shield, Bell, LogOut,
  Wifi, WifiOff, Smartphone, CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { getMeta } from '../../lib/offline-store';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';

export default function PerfilPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    setNombre(localStorage.getItem('portal_nombre') ?? '');
    getMeta('lastSyncAt').then(v => setLastSync(v));

    // Detectar si PWA está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setPwaInstalled(isStandalone);

    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_paciente_id');
    localStorage.removeItem('portal_nombre');
    localStorage.removeItem('portal_sede_id');
    localStorage.removeItem('portal_expediente_adiccion_id');
    router.push('/login');
  };

  const MenuItem = ({ icon: Icon, label, sub, href, onClick, color = 'text-slate-600' }: any) => (
    <Link href={href ?? '#'} onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 shrink-0', color)}>
        <Icon size={16} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-bold text-slate-900">Mi cuenta</h1>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        {/* Avatar y nombre */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
            {nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
          </div>
          <h2 className="font-bold text-slate-900 text-lg">{nombre}</h2>
          <p className="text-slate-400 text-xs mt-1">Portal del paciente</p>
        </div>

        {/* Estado de conexión y sync */}
        <div className={clsx(
          'rounded-2xl border p-4 flex items-center gap-3',
          online ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
        )}>
          {online ? <Wifi size={18} className="text-green-600" /> : <WifiOff size={18} className="text-amber-600" />}
          <div>
            <p className={clsx('text-sm font-medium', online ? 'text-green-800' : 'text-amber-800')}>
              {online ? 'En línea' : 'Sin conexión'}
            </p>
            {lastSync && (
              <p className="text-xs text-slate-500">
                Última sincronización: {format(new Date(lastSync), "d 'de' MMMM, HH:mm", { locale: es })}
              </p>
            )}
          </div>
        </div>

        {/* PWA */}
        {pwaInstalled && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <Smartphone size={18} className="text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Aplicación instalada</p>
              <p className="text-xs text-blue-600">Accede sin internet a sus datos de salud</p>
            </div>
            <CheckCircle size={16} className="ml-auto text-blue-500 shrink-0" />
          </div>
        )}

        {/* Menú */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <MenuItem icon={Shield} label="Privacidad de mis datos" color="text-blue-600"
            sub="Derechos ARCO — LFPDPPP" href="/perfil/privacidad" />
          <div className="border-t border-slate-50" />
          <MenuItem icon={Bell} label="Notificaciones" color="text-purple-600"
            sub="Email y SMS" href="/perfil/notificaciones" />
          <div className="border-t border-slate-50" />
          <MenuItem icon={LogOut} label="Cerrar sesión" color="text-red-500"
            sub="Salir del portal" onClick={handleLogout} />
        </div>

        {/* Info */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-400">SGCI Portal del Paciente v2.1</p>
          <p className="text-xs text-slate-400">Sus datos están protegidos bajo LFPDPPP</p>
        </div>
      </div>
    </div>
  );
}
