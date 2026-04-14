'use client';
// ═══════════════════════════════════════════════════════════
// APP SHELL — Sidebar + Topbar para todas las páginas internas
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar, Users, FileText, FlaskConical, Pill, Receipt,
  BarChart2, Settings, LogOut, ChevronDown, Bell, Search,
  Heart, ClipboardList, Menu, X, Shield, Stethoscope,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth-store';
import { authApi } from '../../lib/api';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard',    icon: BarChart2,      label: 'Dashboard',   roles: [] },
  { href: '/agenda',       icon: Calendar,       label: 'Agenda',      roles: [] },
  { href: '/pacientes',    icon: Users,          label: 'Pacientes',   roles: [] },
  { href: '/consulta',     icon: Stethoscope,    label: 'Consultas',   roles: ['MEDICO','PSICOLOGO','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/adicciones',   icon: Heart,          label: 'Adicciones',  roles: ['MEDICO','PSICOLOGO','TRABAJO_SOCIAL','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/laboratorio',  icon: FlaskConical,   label: 'Laboratorio', roles: ['MEDICO','LABORATORIO','ENFERMERIA','SUPERADMIN','ADMIN_SEDE'] },
  { href: '/recetas',      icon: Pill,           label: 'Recetas',     roles: ['MEDICO','PSICOLOGO','SUPERADMIN'] },
  { href: '/facturacion',  icon: Receipt,        label: 'Facturación', roles: ['CAJA','ADMIN_SEDE','SUPERADMIN'] },
  { href: '/reportes',     icon: ClipboardList,  label: 'Reportes',    roles: ['ADMIN_SEDE','SUPERADMIN'] },
  { href: '/admin',        icon: Settings,       label: 'Admin',       roles: ['ADMIN_SEDE','SUPERADMIN'] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearSession, refreshToken: storedRefresh } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifs, setNotifs] = useState(0);

  const visibleNav = NAV_ITEMS.filter(item =>
    item.roles.length === 0 || item.roles.some(r => user?.roles.includes(r)),
  );

  const handleLogout = async () => {
    if (storedRefresh) {
      try { await authApi.logout(storedRefresh); } catch {}
    }
    clearSession();
    router.push('/login');
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside className={clsx(
        'flex flex-col bg-slate-900 text-white transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-56' : 'w-14',
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 text-sm">🏥</div>
          {sidebarOpen && <span className="font-bold text-sm truncate">SGCI Clínica</span>}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )}>
                <Icon size={16} className="shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {user.nombre[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{user.roles[0]}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-1">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 w-full flex justify-center p-1">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="text-slate-500 hover:text-slate-900 p-1"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Global search */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Buscar paciente, expediente..."
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-slate-400"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notificaciones */}
            <button className="relative text-slate-500 hover:text-slate-900 p-1">
              <Bell size={18} />
              {notifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifs}
                </span>
              )}
            </button>

            {/* Sede badge */}
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              Sede principal
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
