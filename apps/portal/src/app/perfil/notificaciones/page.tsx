'use client';
// /perfil/notificaciones — Preferencias de notificaciones
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Mail, Phone, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

export default function NotificacionesPage() {
  const [prefs, setPrefs] = useState({
    email: true,
    sms: false,
    recordatorio24h: true,
    recordatorio2h: true,
    resultados: true,
    mensajes: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem('portal_notif_prefs');
    if (saved) setPrefs(JSON.parse(saved));
  }, []);

  const toggle = (key: string) => {
    const next = { ...prefs, [key]: !(prefs as any)[key] };
    setPrefs(next);
    localStorage.setItem('portal_notif_prefs', JSON.stringify(next));
  };

  const Toggle = ({ k, label, icon: Icon, sub }: any) => (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <button type="button" onClick={() => toggle(k)}
        className={clsx(
          'w-11 h-6 rounded-full transition-colors relative shrink-0',
          (prefs as any)[k] ? 'bg-blue-600' : 'bg-slate-300',
        )}>
        <div className={clsx(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform',
          (prefs as any)[k] ? 'translate-x-6' : 'translate-x-1',
        )} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <Link href="/perfil" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-bold text-slate-900">Notificaciones</h1>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canales</p>
          </div>
          <Toggle k="email" label="Correo electrónico" icon={Mail} sub="Confirmaciones y recordatorios" />
          <div className="border-t border-slate-50" />
          <Toggle k="sms" label="Mensaje de texto (SMS)" icon={Phone} sub="Recordatorio 2 horas antes" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipos de notificación</p>
          </div>
          <Toggle k="recordatorio24h" label="Recordatorio 24 horas" icon={Bell} sub="Un día antes de su cita" />
          <div className="border-t border-slate-50" />
          <Toggle k="recordatorio2h" label="Recordatorio 2 horas" icon={Bell} sub="Dos horas antes de su cita" />
          <div className="border-t border-slate-50" />
          <Toggle k="resultados" label="Resultados de laboratorio" icon={Bell} sub="Cuando sus resultados estén listos" />
          <div className="border-t border-slate-50" />
          <Toggle k="mensajes" label="Mensajes de la clínica" icon={MessageSquare} sub="Respuestas y comunicados" />
        </div>

        <p className="text-center text-xs text-slate-400">
          Sus preferencias se guardan en este dispositivo
        </p>
      </div>
    </div>
  );
}
