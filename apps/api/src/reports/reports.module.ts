// ═══════════════════════════════════════════════════════════
// REPORTS MODULE — Reportes Operativos y Normativos
// CONADIC · NOM-004 · Financieros · KPIs operativos
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId } from '../auth/strategies/jwt.strategy';
import { Rol, EstadoCFDI } from '@prisma/client';
import { PrismaModule } from '../database/prisma.module';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
  ) {}

  // ─── Dashboard KPIs operativos ───────────────────────────
  async getOperationalKpis(sedeId: string, desde: Date, hasta: Date) {
    const [
      totalCitas,
      citasCompletadas,
      citasCanceladas,
      citasNoShow,
      citasTelemedicina,
      totalPacientesNuevos,
      totalFacturado,
      totalCobrado,
      totalConsultas,
      pacientesAdicciones,
    ] = await Promise.all([
      this.prisma.cita.count({ where: { sedeId, createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.cita.count({ where: { sedeId, estado: 'COMPLETADA', createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.cita.count({ where: { sedeId, estado: 'CANCELADA', createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.cita.count({ where: { sedeId, estado: 'NO_SHOW', createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.cita.count({ where: { sedeId, esTelemedicina: true, createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.paciente.count({ where: { sedeId, createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.factura.aggregate({
        where: { sedeId, estadoCfdi: EstadoCFDI.TIMBRADO, fechaTimbrado: { gte: desde, lte: hasta } },
        _sum: { total: true },
      }),
      this.prisma.factura.aggregate({
        where: { sedeId, estadoCfdi: EstadoCFDI.TIMBRADO, fechaTimbrado: { gte: desde, lte: hasta } },
        _sum: { montoPagado: true },
      }),
      this.prisma.consulta.count({ where: { sedeId, createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.expedienteAdiccion.count({ where: { paciente: { sedeId } } }),
    ]);

    const tasaCompletadas = totalCitas > 0 ? (citasCompletadas / totalCitas * 100).toFixed(1) : '0';
    const tasaCancelacion = totalCitas > 0 ? (citasCanceladas / totalCitas * 100).toFixed(1) : '0';
    const tasaNoShow = totalCitas > 0 ? (citasNoShow / totalCitas * 100).toFixed(1) : '0';

    return {
      periodo: { desde, hasta },
      citas: {
        total: totalCitas,
        completadas: citasCompletadas,
        canceladas: citasCanceladas,
        noShow: citasNoShow,
        telemedicina: citasTelemedicina,
        tasaCompletadas: `${tasaCompletadas}%`,
        tasaCancelacion: `${tasaCancelacion}%`,
        tasaNoShow: `${tasaNoShow}%`,
      },
      pacientes: { nuevos: totalPacientesNuevos },
      adicciones: { expedientesActivos: pacientesAdicciones },
      consultas: { total: totalConsultas },
      financiero: {
        totalFacturado: Number(totalFacturado._sum.total ?? 0).toFixed(2),
        totalCobrado: Number(totalCobrado._sum.montoPagado ?? 0).toFixed(2),
        saldo: (Number(totalFacturado._sum.total ?? 0) - Number(totalCobrado._sum.montoPagado ?? 0)).toFixed(2),
      },
    };
  }

  // ─── Reporte CONADIC (NOM-028) ───────────────────────────
  async getConadicReport(sedeId: string, anio: number, trimestre: 1 | 2 | 3 | 4) {
    const trimestres: Record<number, { inicio: string; fin: string }> = {
      1: { inicio: `${anio}-01-01`, fin: `${anio}-03-31` },
      2: { inicio: `${anio}-04-01`, fin: `${anio}-06-30` },
      3: { inicio: `${anio}-07-01`, fin: `${anio}-09-30` },
      4: { inicio: `${anio}-10-01`, fin: `${anio}-12-31` },
    };
    const { inicio, fin } = trimestres[trimestre];
    const desde = new Date(inicio);
    const hasta = new Date(fin);
    hasta.setHours(23, 59, 59);

    const expedientes = await this.prisma.expedienteAdiccion.findMany({
      where: {
        paciente: { sedeId },
        OR: [
          { fechaIngreso: { gte: desde, lte: hasta } },
          { fechaEgreso: { gte: desde, lte: hasta } },
          { AND: [{ fechaIngreso: { lte: desde } }, { OR: [{ fechaEgreso: null }, { fechaEgreso: { gte: hasta } }] }] },
        ],
      },
      include: { paciente: true },
    });

    // Estructurar datos según formato CONADIC
    const ingresos = expedientes.filter(e => e.fechaIngreso >= desde && e.fechaIngreso <= hasta);
    const egresos = expedientes.filter(e => e.fechaEgreso && e.fechaEgreso >= desde && e.fechaEgreso <= hasta);
    const continuacion = expedientes.filter(e => e.fechaIngreso < desde && (!e.fechaEgreso || e.fechaEgreso > hasta));

    const porSustancia = this.groupBy(expedientes, 'sustanciaPrincipal');
    const porModalidad = this.groupBy(expedientes, 'modalidad');
    const porEstado = this.groupBy(expedientes, 'estadoTratamiento');
    const porSexo = this.groupBy(expedientes.map(e => ({ sexo: e.paciente.sexo })), 'sexo');

    return {
      metadata: {
        unidad: sedeId,
        anio,
        trimestre,
        periodo: { inicio, fin },
        generadoAt: new Date().toISOString(),
        nota: 'Datos preliminares — requieren revisión y firma del responsable antes de enviar a CONADIC',
      },
      resumen: {
        totalEnTratamiento: expedientes.length,
        ingresos: ingresos.length,
        egresos: egresos.length,
        continuacion: continuacion.length,
      },
      distribucionSustancia: porSustancia,
      distribucionModalidad: porModalidad,
      distribucionEstado: porEstado,
      distribucionSexo: porSexo,
      expedientes: expedientes.map(e => ({
        id: e.id,
        modalidad: e.modalidad,
        sustanciaPrincipal: e.sustanciaPrincipal,
        estadoTratamiento: e.estadoTratamiento,
        fechaIngreso: e.fechaIngreso,
        fechaEgreso: e.fechaEgreso,
        // Datos demográficos anonimizados (sin identificadores personales)
        sexo: e.paciente.sexo,
        edadInicio: e.edadInicio,
      })),
    };
  }

  // ─── Reporte financiero ──────────────────────────────────
  async getFinancialReport(sedeId: string, desde: Date, hasta: Date, formato: string) {
    return this.billing.exportAccounting(sedeId, desde, hasta, formato as any);
  }

  // ─── Reporte de médico ───────────────────────────────────
  async getMedicoReport(medicoId: string, desde: Date, hasta: Date) {
    const [consultas, citasMedico] = await Promise.all([
      this.prisma.consulta.count({ where: { medicoId, createdAt: { gte: desde, lte: hasta } } }),
      this.prisma.cita.groupBy({
        by: ['estado'],
        where: { medicoId, createdAt: { gte: desde, lte: hasta } },
        _count: { estado: true },
      }),
    ]);

    return {
      medicoId,
      periodo: { desde, hasta },
      consultas,
      citas: citasMedico.reduce((acc, c) => ({ ...acc, [c.estado]: c._count.estado }), {}),
    };
  }

  // ─── Helper: agrupar por propiedad ───────────────────────
  private groupBy<T extends Record<string, any>>(arr: T[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      const val = String(item[key] ?? 'Sin definir');
      acc[val] = (acc[val] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('operational')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'KPIs operativos de la sede (citas, pacientes, financiero)' })
  async getOperational(
    @SedeId() sedeId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.svc.getOperationalKpis(sedeId, new Date(desde), new Date(hasta));
  }

  @Get('conadic')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO)
  @ApiOperation({ summary: 'Reporte CONADIC NOM-028 — datos para reporte trimestral' })
  async getConadic(
    @SedeId() sedeId: string,
    @Query('anio') anio: string,
    @Query('trimestre') trimestre: string,
  ) {
    return this.svc.getConadicReport(sedeId, +anio, +trimestre as any);
  }

  @Get('accounting')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Exportación contable — Excel / CSV QBO / ZIP XMLs CFDI' })
  async getAccounting(
    @SedeId() sedeId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('formato') formato: string = 'xlsx',
  ) {
    return this.svc.getFinancialReport(sedeId, new Date(desde), new Date(hasta), formato);
  }

  @Get('medico/:medicoId')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO)
  @ApiOperation({ summary: 'Reporte individual de médico' })
  async getMedicoReport(
    @Param('medicoId') medicoId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.svc.getMedicoReport(medicoId, new Date(desde), new Date(hasta));
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
