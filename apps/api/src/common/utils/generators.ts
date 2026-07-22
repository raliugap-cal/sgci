import { format } from 'date-fns';

export function generateExpedienteNumber(sedePrefix: string, counter: number): string {
  const year = new Date().getFullYear();
  return `EXP-${sedePrefix}-${year}-${String(counter).padStart(5, '0')}`;
}

export function generateFacturaNumber(sedePrefix: string, counter: number): string {
  const yearMonth = format(new Date(), 'yyyyMM');
  return `FAC-${sedePrefix}-${yearMonth}-${String(counter).padStart(5, '0')}`;
}

export function generateOrdenNumber(prefix = 'LAB'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export function generateCodigoBarra(): string {
  return `SGC${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
}

export function generateBarCode(): string {
  return `SGC${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
}

export function generateRecetaNumber(tipo: string): string {
  const prefix = tipo === 'ESTUPEFACIENTE' ? 'RE' : tipo === 'ESPECIAL' ? 'RES' : 'R';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}
