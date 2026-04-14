'use client';
// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS — Primitivos de UI
// Button · Card · Badge · Input · Modal · Spinner · Empty
// ═══════════════════════════════════════════════════════════
import { forwardRef, ReactNode, useState } from 'react';
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Button ───────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
    const variants = {
      primary:   'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
      secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40',
      danger:    'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
      ghost:     'text-slate-600 hover:bg-slate-100 disabled:opacity-40',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-4 py-2 text-sm rounded-lg',
      lg: 'px-5 py-2.5 text-sm rounded-xl font-semibold',
    };
    return (
      <button ref={ref} disabled={disabled || loading}
        className={cn('inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed', variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Spinner size={14} /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ─── Card ─────────────────────────────────────────────────
export function Card({ children, className, padding = true }: {
  children: ReactNode; className?: string; padding?: boolean;
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200', padding && 'p-5', className)}>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────
type BadgeVariant = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'slate' | 'emerald';
export function Badge({ label, variant = 'slate' }: { label: string; variant?: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    blue:    'bg-blue-100 text-blue-700',
    green:   'bg-green-100 text-green-700',
    red:     'bg-red-100 text-red-600',
    amber:   'bg-amber-100 text-amber-700',
    purple:  'bg-purple-100 text-purple-700',
    slate:   'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', colors[variant])}>{label}</span>;
}

// ─── Input ────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div>
      {label && <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>}
      <input ref={ref}
        className={cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200', className)}
        {...props} />
      {error && <p className="text-red-600 text-xs mt-0.5 flex items-center gap-1"><XCircle size={11} />{error}</p>}
      {hint && !error && <p className="text-slate-400 text-xs mt-0.5">{hint}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

// ─── Select ───────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div>
      {label && <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>}
      <select ref={ref}
        className={cn('w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500',
          error ? 'border-red-300' : 'border-slate-200', className)}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-red-600 text-xs mt-0.5">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

// ─── Spinner ──────────────────────────────────────────────
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('border-2 border-current border-t-transparent rounded-full animate-spin', className)}
      style={{ width: size, height: size }} />
  );
}

// ─── Empty State ──────────────────────────────────────────
export function Empty({ icon: Icon, title, description, action }: {
  icon: any; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon size={36} className="text-slate-300 mb-3" />
      <p className="font-medium text-slate-600 mb-1">{title}</p>
      {description && <p className="text-slate-400 text-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── Alert ────────────────────────────────────────────────
type AlertVariant = 'info' | 'success' | 'warning' | 'error';
export function Alert({ variant, title, children }: {
  variant: AlertVariant; title?: string; children: ReactNode;
}) {
  const cfg = {
    info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',   icon: Info         },
    success: { bg: 'bg-green-50 border-green-200',  text: 'text-green-800',  icon: CheckCircle  },
    warning: { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-800',  icon: AlertTriangle},
    error:   { bg: 'bg-red-50 border-red-200',      text: 'text-red-800',    icon: XCircle      },
  }[variant];
  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border', cfg.bg)}>
      <Icon size={16} className={cn('shrink-0 mt-0.5', cfg.text)} />
      <div className={cfg.text}>
        {title && <p className="font-semibold mb-0.5 text-sm">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────
export function Pagination({ meta, onPage }: {
  meta: { page: number; totalPages: number; total: number; hasPrev: boolean; hasNext: boolean; limit: number };
  onPage: (p: number) => void;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
      <span className="text-slate-500 text-xs">
        Página {meta.page} de {meta.totalPages} · {meta.total} registros
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!meta.hasPrev} onClick={() => onPage(meta.page - 1)}>
          ← Anterior
        </Button>
        <Button variant="secondary" size="sm" disabled={!meta.hasNext} onClick={() => onPage(meta.page + 1)}>
          Siguiente →
        </Button>
      </div>
    </div>
  );
}
