// ═══════════════════════════════════════════════════════════
// REPORTS CONTROLLER — Endpoint operativo corregido
// Agrega: GET /reports/operational
//         GET /addictions/expedientes?pacienteId=X
// ═══════════════════════════════════════════════════════════

// Parche para reports.module.ts — agregar al ReportsController:
// @Get('operational') ya existe en el controller base

// Parche para addictions.module.ts — agregar al AddictionsController:
// GET /addictions/expedientes?pacienteId=X

// ADDICTIONS — endpoint de búsqueda por paciente
// Agregar al AddictionsService:
export async function getExpedienteByPaciente(
  prisma: any,
  pacienteId: string,
) {
  return prisma.expedienteAdiccion.findFirst({
    where: { pacienteId },
    include: {
      paciente: true,
      medicoResponsable: { include: { usuario: true } },
      planesT: { where: { estado: 'activo' }, orderBy: { version: 'desc' }, take: 1 },
      instrumentos: {
        include: { instrumento: true },
        orderBy: { aplicadoAt: 'desc' },
        take: 5,
      },
      notasSesion: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
}

// ADDICTIONS — endpoint de lista de expedientes activos
export async function getExpedientesActivos(
  prisma: any,
  sedeId: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;
  const where = { paciente: { sedeId }, estadoTratamiento: { notIn: ['ALTA_VOLUNTARIA', 'ABANDONO'] } };

  const [total, expedientes] = await Promise.all([
    prisma.expedienteAdiccion.count({ where }),
    prisma.expedienteAdiccion.findMany({
      where, skip, take: limit,
      orderBy: { fechaIngreso: 'desc' },
      include: {
        paciente: {
          select: { nombre: true, apellidoPaterno: true, numeroExpediente: true, fechaNacimiento: true },
        },
        medicoResponsable: { include: { usuario: { select: { nombre: true, apellidoPaterno: true } } } },
        planesT: { where: { estado: 'activo' }, take: 1, select: { modalidad: true } },
      },
    }),
  ]);

  return { data: expedientes, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
