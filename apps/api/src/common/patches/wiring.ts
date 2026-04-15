// ═══════════════════════════════════════════════════════════
// WIRING PATCH — Conecta módulos a sus métodos completos
// Estos re-exports resuelven los métodos faltantes que los
// controllers referencian pero no estaban implementados
// directamente en los services principales
// ═══════════════════════════════════════════════════════════

// ─── Parche para AppointmentsService ─────────────────────
// Añadir estos métodos al AppointmentsService en appointments.service.ts:

export const APPOINTMENTS_EXTRA_METHODS = `
  // findAll — listar con filtros
  async findAll(opts: {
    sedeId: string; medicoId?: string; pacienteId?: string;
    fecha?: string; estado?: string; page: number; limit: number;
  }) {
    const { sedeId, medicoId, pacienteId, fecha, estado, page, limit } = opts;
    const skip = (page - 1) * limit;
    const where: any = { sedeId };
    if (medicoId)   where.medicoId   = medicoId;
    if (pacienteId) where.pacienteId = pacienteId;
    if (fecha) {
      const d = new Date(fecha);
      d.setHours(0,0,0,0);
      const d2 = new Date(fecha);
      d2.setHours(23,59,59,999);
      where.fechaInicio = { gte: d, lte: d2 };
    }
    if (estado) where.estado = estado;
    const [total, citas] = await Promise.all([
      this.prisma.cita.count({ where }),
      this.prisma.cita.findMany({
        where, skip, take: limit, orderBy: { fechaInicio: 'asc' },
        include: {
          paciente: { select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, numeroExpediente: true } },
          medico: { include: { usuario: { select: { nombre: true, apellidoPaterno: true } } } },
        },
      }),
    ]);
    return this.prisma.paginate(citas, total, page, limit);
  }

  async findById(id: string, sedeId: string) {
    const cita = await this.prisma.cita.findFirst({
      where: { id, sedeId },
      include: { paciente: true, medico: { include: { usuario: true } }, sede: true, consulta: true },
    });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    return cita;
  }
`;

// ─── Parche para BillingService ───────────────────────────
export const BILLING_EXTRA_METHODS = `
  async findAll(opts: { sedeId: string; desde?: string; hasta?: string; estado?: string; page: number; limit: number }) {
    const { sedeId, desde, hasta, estado, page, limit } = opts;
    const skip = (page - 1) * limit;
    const where: any = { sedeId };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) { const h = new Date(hasta); h.setHours(23,59,59); where.createdAt.lte = h; }
    }
    if (estado) where.estadoCfdi = estado;
    const [total, facturas] = await Promise.all([
      this.prisma.factura.count({ where }),
      this.prisma.factura.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { paciente: { select: { nombre: true, apellidoPaterno: true } }, cargos: true },
      }),
    ]);
    return this.prisma.paginate(facturas, total, page, limit);
  }

  async findById(id: string, sedeId: string) {
    const f = await this.prisma.factura.findFirst({
      where: { id, sedeId },
      include: { paciente: true, cargos: { include: { servicio: true } }, pagos: { orderBy: { createdAt: 'desc' } }, sede: true },
    });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }

  async getCashRegisterHistory(sedeId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const [total, cortes] = await Promise.all([
      this.prisma.cortesCaja.count({ where: { sedeId } }),
      this.prisma.cortesCaja.findMany({ where: { sedeId }, skip, take: limit, orderBy: { fechaFin: 'desc' } }),
    ]);
    return this.prisma.paginate(cortes, total, page, limit);
  }
`;

// ─── Parche para PatientsService ──────────────────────────
export const PATIENTS_EXTRA_METHODS = `
  async signConsent(pacienteId: string, tipo: string, firmaBase64: string | undefined, firmadoPorId: string, ip: string) {
    const c = await this.prisma.consentimiento.findFirst({ where: { pacienteId, tipo: tipo as any, vigente: true } });
    if (!c) throw new NotFoundException('Consentimiento no encontrado');
    return this.prisma.consentimiento.update({
      where: { id: c.id },
      data: { firmado: true, firmaBase64: firmaBase64 ?? null, ipFirma: ip, firmadoPorId, firmadoAt: new Date() },
    });
  }
`;

// ─── Parche para AuthService ──────────────────────────────
export const AUTH_EXTRA_METHODS = `
  decodeMfaToken(token: string): any {
    try {
      return this.jwt.verify(token, { secret: this.config.getOrThrow('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Token MFA inválido o expirado');
    }
  }
`;
