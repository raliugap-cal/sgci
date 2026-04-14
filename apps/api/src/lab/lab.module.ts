// ═══════════════════════════════════════════════════════════
// LAB MODULE — Laboratorio Interno
// Órdenes · Toma de Muestra · Captura de Resultados · Alertas
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { AuditService } from '../common/services/audit.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol, EstadoOrden } from '@prisma/client';
import { PrismaModule } from '../database/prisma.module';
import { generateBarCode } from '../common/services/audit.service';
import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsUUID } from 'class-validator';

// ─── DTOs ────────────────────────────────────────────────
class CreateOrdenDto {
  @IsUUID() pacienteId: string;
  @IsOptional() @IsUUID() consultaId?: string;
  @IsArray() @IsUUID(undefined, { each: true }) estudioIds: string[];
  @IsOptional() @IsString() instruccionesPaciente?: string;
}

class CapturarResultadoDto {
  @IsOptional() @IsUUID() itemOrdenId?: string;
  @IsString() estudioNombre: string;
  @IsOptional() @IsString() valor?: string;
  @IsOptional() @IsString() unidades?: string;
  @IsOptional() @IsString() referenciaNormal?: string;
  @IsOptional() @IsBoolean() fueraRango?: boolean;
  @IsOptional() @IsBoolean() valorCritico?: boolean;
  @IsOptional() @IsString() observaciones?: string;
}

class LiberarOrdenDto {
  @IsOptional() @IsString() notas?: string;
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class LabService {
  private readonly logger = new Logger(LabService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  // ─── Emitir orden de laboratorio ────────────────────────
  async createOrden(dto: CreateOrdenDto, medicoId: string, sedeId: string, actorId: string, ip: string) {
    // Verificar que todos los estudios existen
    const estudios = await this.prisma.estudioLab.findMany({
      where: { id: { in: dto.estudioIds }, activo: true },
    });
    if (estudios.length !== dto.estudioIds.length) {
      throw new BadRequestException('Uno o más estudios no encontrados');
    }

    const orden = await this.prisma.ordenLaboratorio.create({
      data: {
        pacienteId: dto.pacienteId,
        consultaId: dto.consultaId,
        medicoId,
        sedeId,
        codigoBarra: generateBarCode(),
        instruccionesPaciente: dto.instruccionesPaciente,
        estado: EstadoOrden.EMITIDA,
        actorId,
        items: {
          create: dto.estudioIds.map(id => ({ estudioId: id })),
        },
      },
      include: {
        items: { include: { estudio: true } },
        paciente: true,
        medico: { include: { usuario: true } },
      },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE', recursoTipo: 'orden_laboratorio', recursoId: orden.id });
    return orden;
  }

  // ─── Toma de muestra ────────────────────────────────────
  async registrarTomaMuestra(ordenId: string, tomadoPorId: string, sedeId: string) {
    const orden = await this.prisma.ordenLaboratorio.findFirst({ where: { id: ordenId, sedeId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.estado !== EstadoOrden.EMITIDA) throw new BadRequestException('La muestra ya fue tomada');

    return this.prisma.ordenLaboratorio.update({
      where: { id: ordenId },
      data: {
        estado: EstadoOrden.MUESTRA_TOMADA,
        fechaTomaMuestra: new Date(),
        tomadoPorId,
      },
    });
  }

  // ─── Capturar resultados ─────────────────────────────────
  async capturarResultados(ordenId: string, resultados: CapturarResultadoDto[], procesadoPorId: string, sedeId: string) {
    const orden = await this.prisma.ordenLaboratorio.findFirst({
      where: { id: ordenId, sedeId },
      include: { items: true },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');

    // Crear los resultados
    await this.prisma.$transaction([
      this.prisma.resultadoLab.createMany({
        data: resultados.map(r => ({
          ordenId,
          itemOrdenId: r.itemOrdenId,
          estudioNombre: r.estudioNombre,
          valor: r.valor,
          unidades: r.unidades,
          referenciaNormal: r.referenciaNormal,
          fueraRango: r.fueraRango ?? false,
          valorCritico: r.valorCritico ?? false,
          observaciones: r.observaciones,
          actorId: procesadoPorId,
        })),
      }),
      this.prisma.ordenLaboratorio.update({
        where: { id: ordenId },
        data: {
          estado: EstadoOrden.RESULTADO_CAPTURADO,
          fechaProcesamiento: new Date(),
          procesadoPorId,
        },
      }),
    ]);

    return this.prisma.ordenLaboratorio.findUniqueOrThrow({
      where: { id: ordenId },
      include: { resultados: true, items: { include: { estudio: true } } },
    });
  }

  // ─── Liberar resultados ──────────────────────────────────
  async liberarOrden(ordenId: string, dto: LiberarOrdenDto, liberadoPorId: string, sedeId: string, ip: string) {
    const orden = await this.prisma.ordenLaboratorio.findFirst({
      where: { id: ordenId, sedeId },
      include: {
        resultados: true,
        paciente: true,
        medico: { include: { usuario: true } },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.estado !== EstadoOrden.RESULTADO_CAPTURADO) {
      throw new BadRequestException('La orden debe tener resultados capturados antes de liberar');
    }

    const updated = await this.prisma.ordenLaboratorio.update({
      where: { id: ordenId },
      data: {
        estado: EstadoOrden.LIBERADA,
        fechaResultado: new Date(),
        liberadoPorId,
        notificadoMedico: true,
        notificadoAt: new Date(),
      },
    });

    // Verificar valores críticos
    const criticos = orden.resultados.filter(r => r.valorCritico);
    const esCritico = criticos.length > 0;

    if (esCritico) {
      this.logger.warn(`⚠️ VALOR CRÍTICO en orden ${ordenId}: ${criticos.map(c => c.estudioNombre).join(', ')}`);
      // Notificación urgente al médico (email + SMS independiente del canal configurado)
      await this.notifications.sendLabResultReady(orden, orden.paciente, true);
    } else {
      await this.notifications.sendLabResultReady(orden, orden.paciente, false);
    }

    await this.audit.log({ actorId: liberadoPorId, sedeId, ip, accion: 'LIBERAR_RESULTADO', recursoTipo: 'orden_laboratorio', recursoId: ordenId, datosNuevos: { esCritico } });
    return updated;
  }

  // ─── Obtener orden con resultados ────────────────────────
  async getOrden(ordenId: string, sedeId: string) {
    const orden = await this.prisma.ordenLaboratorio.findFirst({
      where: { id: ordenId, sedeId },
      include: {
        items: { include: { estudio: true, resultados: true } },
        resultados: true,
        paciente: true,
        medico: { include: { usuario: true } },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  // ─── Listar órdenes por paciente ─────────────────────────
  async getOrdenesByPaciente(pacienteId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, ordenes] = await Promise.all([
      this.prisma.ordenLaboratorio.count({ where: { pacienteId } }),
      this.prisma.ordenLaboratorio.findMany({
        where: { pacienteId },
        skip,
        take: limit,
        orderBy: { fechaEmision: 'desc' },
        include: { items: { include: { estudio: true } }, resultados: true },
      }),
    ]);
    return { data: ordenes, meta: { total, page, limit } };
  }

  // ─── Catálogo de estudios ────────────────────────────────
  async getEstudios(q?: string) {
    return this.prisma.estudioLab.findMany({
      where: {
        activo: true,
        ...(q && { OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { clave: { startsWith: q.toUpperCase() } },
        ]}),
      },
      orderBy: { nombre: 'asc' },
    });
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('lab')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lab')
export class LabController {
  constructor(private labService: LabService) {}

  @Post('orders')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Emitir orden de laboratorio' })
  async createOrden(@Body() dto: CreateOrdenDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.labService.createOrden(dto, u.medicoId, s, u.userId, ip);
  }

  @Post('orders/:id/collect')
  @Roles(Rol.LABORATORIO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Registrar toma de muestra' })
  async collect(@Param('id') id: string, @CurrentUser() u: any, @SedeId() s: string) {
    return this.labService.registrarTomaMuestra(id, u.userId, s);
  }

  @Post('orders/:id/results')
  @Roles(Rol.LABORATORIO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Capturar resultados de estudios' })
  async captureResults(@Param('id') id: string, @Body() dto: { resultados: CapturarResultadoDto[] }, @CurrentUser() u: any, @SedeId() s: string) {
    return this.labService.capturarResultados(id, dto.resultados, u.userId, s);
  }

  @Post('orders/:id/release')
  @Roles(Rol.LABORATORIO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Liberar resultados y notificar médico/paciente' })
  async release(@Param('id') id: string, @Body() dto: LiberarOrdenDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.labService.liberarOrden(id, dto, u.userId, s, ip);
  }

  @Get('orders/:id')
  @Roles(Rol.MEDICO, Rol.LABORATORIO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  async getOrden(@Param('id') id: string, @SedeId() s: string) {
    return this.labService.getOrden(id, s);
  }

  @Get('patients/:pacienteId/orders')
  @Roles(Rol.MEDICO, Rol.LABORATORIO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  async getPatientOrders(@Param('pacienteId') id: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.labService.getOrdenesByPaciente(id, +page, +limit);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo de estudios disponibles' })
  async getCatalog(@Query('q') q?: string) {
    return this.labService.getEstudios(q);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [LabController],
  providers: [LabService, AuditService],
  exports: [LabService],
})
export class LabModule {}
