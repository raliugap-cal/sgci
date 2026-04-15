// ═══════════════════════════════════════════════════════════
// SHARED UI — cn utility + Toast component
// ═══════════════════════════════════════════════════════════
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// tailwind-merge + clsx helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency MXN
export function formatMXN(amount: number | string) {
  return Number(amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// Format date Spanish
export function formatDateES(date: string | Date, opts: { time?: boolean } = {}) {
  const d = new Date(date);
  const base = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  if (!opts.time) return base;
  return `${base} a las ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
}

// Calcular edad
export function calcularEdad(fechaNacimiento: string | Date): number {
  const hoy = new Date();
  const fn = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - fn.getFullYear();
  if (hoy.getMonth() < fn.getMonth() || (hoy.getMonth() === fn.getMonth() && hoy.getDate() < fn.getDate())) {
    edad--;
  }
  return edad;
}

// Obtener iniciales
export function getInitials(nombre: string, apellido: string): string {
  return `${(nombre[0] ?? '').toUpperCase()}${(apellido[0] ?? '').toUpperCase()}`;
}

// Truncar texto
export function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...' : str;
}

// Generar color determinista para un ID
export function idToColor(id: string): string {
  const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Validar CURP mexicana
export const CURP_REGEX = /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}\d{1}$/;

export function isValidCurp(curp: string): boolean {
  return CURP_REGEX.test(curp.toUpperCase());
}
