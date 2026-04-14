'use client';
// ═══════════════════════════════════════════════════════════
// BOTTOM NAV — Portal paciente (móvil)
// Fijo en la parte inferior · 5 accesos rápidos
// ═══════════════════════════════════════════════════════════
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Heart, FlaskConical, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/dashboard',  icon: Home,          label: 'Inicio'     },
  { href: '/citas',      icon: Calendar,      label: 'Citas'      },
  { href: '/mi-salud',   icon: Heart,         label: 'Mi salud'   },
  { href: '/resultados', icon: FlaskConical,  label: 'Resultados' },
  { href: '/mensajes',   icon: MessageSquare, label: 'Mensajes'   },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-bottom z-50">
      <div className="flex items-center max-w-md mx-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
