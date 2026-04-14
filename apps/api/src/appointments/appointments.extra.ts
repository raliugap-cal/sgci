// ─── appointments.extra.ts — métodos adicionales para el service ──
// Agregar a appointments.service.ts

import { PrismaService } from '../database/prisma.service';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { EstadoCita } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

// findAll — listar citas con filtros
export async function findAll(
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
  if (medicoId) where.medicoId = medicoId;
  if (pacienteId) where.pacienteId = pacienteId;
  if (fecha) {
    const d = parseISO(fecha);
    where.fechaInicio = { gte: startOfDay(d), lte: endOfDay(d) };
  }
  if (estado) where.estado = estado as EstadoCita;

  const [total, citas] = await Promise.all([
    prisma.cita.count({ where }),
    prisma.cita.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
      include: {
        paciente: { select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, numeroExpediente: true } },
        medico: { include: { usuario: { select: { nombre: true, apellidoPaterno: true } } } },
      },
    }),
  ]);

  return prisma.paginate(citas, total, page, limit);
}

// findById
export async function findById(prisma: PrismaService, id: string, sedeId: string) {
  const cita = await prisma.cita.findFirst({
    where: { id, sedeId },
    include: {
      paciente: true,
      medico: { include: { usuario: true, especialidades: { include: { especialidad: true } } } },
      sede: true,
      consulta: true,
    },
  });
  if (!cita) throw new NotFoundException('Cita no encontrada');
  return cita;
}
