// ═══════════════════════════════════════════════════════════
// MÉTODOS ADICIONALES — billing.service.extra.ts
// findAll · findById · getCashRegisterHistory
// Se integran al BillingService principal
// ═══════════════════════════════════════════════════════════

import { PrismaService } from '../database/prisma.service';
import { EstadoCFDI, EstadoPago } from '@prisma/client';

export async function billingFindAll(
  prisma: PrismaService,
  opts: {
    sedeId: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    page: number;
    limit: number;
  },
) {
  const { sedeId, desde, hasta, estado, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: any = { sedeId };
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta + 'T23:59:59');
  }
  if (estado) where.estadoCfdi = estado as EstadoCFDI;

  const [total, facturas] = await Promise.all([
    prisma.factura.count({ where }),
    prisma.factura.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        paciente: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } },
        cargos: { select: { concepto: true, total: true } },
      },
    }),
  ]);

  return prisma.paginate(facturas, total, page, limit);
}

export async function billingFindById(prisma: PrismaService, facturaId: string, sedeId: string) {
  const f = await prisma.factura.findFirst({
    where: { id: facturaId, sedeId },
    include: {
      paciente: true,
      cargos: { include: { servicio: true } },
      pagos: { orderBy: { createdAt: 'desc' } },
      sede: { select: { nombre: true, rfc: true, razonSocial: true } },
    },
  });
  if (!f) throw new Error('Factura no encontrada');
  return f;
}

export async function getCashRegisterHistory(
  prisma: PrismaService,
  sedeId: string,
  page: number,
) {
  const limit = 20;
  const skip = (page - 1) * limit;
  const [total, cortes] = await Promise.all([
    prisma.cortesCaja.count({ where: { sedeId } }),
    prisma.cortesCaja.findMany({
      where: { sedeId },
      skip,
      take: limit,
      orderBy: { fechaFin: 'desc' },
    }),
  ]);
  return prisma.paginate(cortes, total, page, limit);
}

// ═══════════════════════════════════════════════════════════
// MÉTODOS ADICIONALES — appointments.service.extra.ts
// findAll · findById (implementación final)
// ═══════════════════════════════════════════════════════════

import { NotFoundException } from '@nestjs/common';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { EstadoCita } from '@prisma/client';

export async function appointmentsFindAll(
  prisma: PrismaService,
  opts: {
    sedeId: string;
    medicoId?: string;
    pacienteId?: string;
    fecha?: string;
    estado?: string;
    page: number;
    limit: number;
  },
) {
  const { sedeId, medicoId, pacienteId, fecha, estado, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: any = { sedeId };
  if (medicoId)    where.medicoId    = medicoId;
  if (pacienteId)  where.pacienteId  = pacienteId;
  if (fecha) {
    const d = parseISO(fecha);
    where.fechaInicio = { gte: startOfDay(d), lte: endOfDay(d) };
  }
  if (estado) where.estado = estado as EstadoCita;

  const [total, citas] = await Promise.all([
    prisma.cita.count({ where }),
    prisma.cita.findMany({
      where, skip, take: limit,
      orderBy: { fechaInicio: 'asc' },
      include: {
        paciente: {
          select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, numeroExpediente: true },
        },
        medico: {
          include: { usuario: { select: { nombre: true, apellidoPaterno: true } } },
        },
      },
    }),
  ]);

  return prisma.paginate(citas, total, page, limit);
}

export async function appointmentsFindById(
  prisma: PrismaService,
  id: string,
  sedeId: string,
) {
  const cita = await prisma.cita.findFirst({
    where: { id, sedeId },
    include: {
      paciente: true,
      medico: {
        include: {
          usuario: true,
          especialidades: { include: { especialidad: true } },
        },
      },
      sede: true,
      consulta: true,
    },
  });
  if (!cita) throw new NotFoundException('Cita no encontrada');
  return cita;
}

// ═══════════════════════════════════════════════════════════
// PARCHE — patients.service.extra.ts
// signConsent — firma de consentimiento
// ═══════════════════════════════════════════════════════════

import * as bcrypt from 'bcryptjs';

export async function signConsent(
  prisma: PrismaService,
  pacienteId: string,
  tipo: string,
  firmaBase64: string | undefined,
  firmadoPorId: string,
  ip: string,
) {
  const consentimiento = await prisma.consentimiento.findFirst({
    where: { pacienteId, tipo: tipo as any, vigente: true },
  });
  if (!consentimiento) throw new Error(`Consentimiento de tipo ${tipo} no encontrado`);

  return prisma.consentimiento.update({
    where: { id: consentimiento.id },
    data: {
      firmado: true,
      firmaBase64: firmaBase64 ?? null,
      ipFirma: ip,
      firmadoPorId,
      firmadoAt: new Date(),
    },
  });
}

// ═══════════════════════════════════════════════════════════
// PARCHE — auth.service.extra.ts
// decodeMfaToken — para el controller de verificación MFA
// ═══════════════════════════════════════════════════════════

export function decodeMfaToken(jwtService: any, token: string, secret: string): any {
  try {
    return jwtService.verify(token, { secret });
  } catch {
    throw new Error('Token MFA inválido o expirado');
  }
}
