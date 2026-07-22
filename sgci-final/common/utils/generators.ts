// ═══════════════════════════════════════════════════════════
// GENERADORES — Números de expediente, factura, receta, barcode
// ═══════════════════════════════════════════════════════════
import { format } from 'date-fns';

// ─── Expediente ───────────────────────────────────────────
// Acepta tanto (sedeId: string, lastExpediente?: string) como uso legacy
export function generateExpedienteNumber(
  sedeId: string,
  lastExpedienteOrCounter?: string | number | null,
): string {
  const year = new Date().getFullYear();
  const sedePrefix = sedeId.substring(0, 3).toUpperCase();

  let seq = 1;
  if (typeof lastExpedienteOrCounter === 'number') {
    seq = lastExpedienteOrCounter + 1;
  } else if (typeof lastExpedienteOrCounter === 'string') {
    const match = lastExpedienteOrCounter.match(/(\d{5})$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `EXP-${String(seq).padStart(6, '0')}-${year}-${String(seq).padStart(5, '0')}`;
}

// ─── Factura ──────────────────────────────────────────────
// Acepta (prisma, sedeId) para uso en billing.service
export async function generateFacturaNumber(
  prismaOrPrefix: any,
  sedeIdOrCounter: string | number,
): Promise<string> {
  const yearMonth = format(new Date(), 'yyyyMM');

  // Si el primer argumento tiene .factura (es PrismaService)
  if (prismaOrPrefix && typeof prismaOrPrefix === 'object' && prismaOrPrefix.factura) {
    const sedeId = sedeIdOrCounter as string;
    const sedePrefix = sedeId.substring(0, 3).toUpperCase();
    const count = await prismaOrPrefix.factura.count({
      where: {
        sedeId,
        createdAt: { gte: new Date(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`) },
      },
    });
    return `FAC-${sedePrefix}-${yearMonth}-${String(count + 1).padStart(5, '0')}`;
  }

  // Uso legacy: (sedePrefix: string, counter: number)
  const sedePrefix = String(prismaOrPrefix).substring(0, 3).toUpperCase();
  const counter    = typeof sedeIdOrCounter === 'number' ? sedeIdOrCounter : 1;
  return `FAC-${sedePrefix}-${yearMonth}-${String(counter).padStart(5, '0')}`;
}

// ─── Orden de laboratorio ─────────────────────────────────
export function generateOrdenNumber(prefix = 'LAB'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ─── Código de barras ─────────────────────────────────────
export function generateBarCode(): string {
  return `SGC${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
}

export function generateCodigoBarra(): string {
  return generateBarCode();
}

// ─── Receta ───────────────────────────────────────────────
export function generateRecetaNumber(tipo: string): string {
  const prefix = tipo === 'ESTUPEFACIENTE' ? 'RCE' : tipo === 'ESPECIAL' ? 'RCX' : 'RCO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
