// ═══════════════════════════════════════════════════════════
// ADMIN MODULE — Configuración de Sede · Catálogos · Folios
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { PrismaModule } from '../database/prisma.module';
import {
  JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp,
} from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsArray, IsNumber, IsObject } from 'class-validator';

// ─── DTOs ────────────────────────────────────────────────
class UpdateSedeDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsObject() configJson?: Record<string, any>;
}

class AddFoliosDto {
  @IsString() medicoId: string;
  @IsArray() @IsString({ each: true }) folios: string[];
}

class CreateServicioDto {
  @IsString() clave: string;
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsString() claveSAT: string;
  @IsOptional() @IsString() claveUnidadSAT?: string;
  @IsNumber() precio: number;
  @IsOptional() @IsBoolean() ivaAplicable?: boolean;
  @IsOptional() @IsNumber() tasaIva?: number;
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ─── Configuración de sede ───────────────────────────────
  async getSede(sedeId: string) {
    return this.prisma.sede.findUniqueOrThrow({
      where: { id: sedeId },
      include: { horarios: true },
    });
  }

  async updateSede(sedeId: string, dto: UpdateSedeDto, actorId: string, ip: string) {
    const updated = await this.prisma.sede.update({
      where: { id: sedeId },
      data: { ...dto, actorId },
    });
    await this.audit.log({ actorId, sedeId, ip, accion: 'UPDATE', recursoTipo: 'sede', recursoId: sedeId });
    return updated;
  }

  // ─── Médicos de la sede ──────────────────────────────────
  async getMedicos(sedeId: string) {
    return this.prisma.medico.findMany({
      where: { usuario: { sedeId }, activo: true },
      include: {
        usuario: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true, email: true, activo: true } },
        especialidades: { include: { especialidad: true } },
      },
      orderBy: { usuario: { apellidoPaterno: 'asc' } },
    });
  }

  // ─── Folios COFEPRIS para controladas ────────────────────
  async addFoliosCofepris(dto: AddFoliosDto, actorId: string, sedeId: string, ip: string) {
    const medico = await this.prisma.medico.findUniqueOrThrow({ where: { id: dto.medicoId } });
    const nuevosFolios = [...medico.foliosCofepris, ...dto.folios];
    const updated = await this.prisma.medico.update({
      where: { id: dto.medicoId },
      data: { foliosCofepris: nuevosFolios },
    });
    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'ADD_FOLIOS_COFEPRIS',
      recursoTipo: 'medico',
      recursoId: dto.medicoId,
      datosNuevos: { foliosAgregados: dto.folios.length, totalAhora: nuevosFolios.length },
    });
    return { foliosDisponibles: updated.foliosCofepris.length };
  }

  // ─── Catálogo de servicios ────────────────────────────────
  async getServicios(q?: string) {
    return this.prisma.servicioCatalogo.findMany({
      where: {
        activo: true,
        ...(q && {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { clave: { startsWith: q.toUpperCase() } },
          ],
        }),
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async createServicio(dto: CreateServicioDto, actorId: string) {
    return this.prisma.servicioCatalogo.create({
      data: {
        clave: dto.clave.toUpperCase(),
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        claveSAT: dto.claveSAT,
        claveUnidadSAT: dto.claveUnidadSAT ?? 'E48',
        precio: dto.precio,
        ivaAplicable: dto.ivaAplicable ?? false,
        tasaIva: dto.tasaIva ?? 0,
      },
    });
  }

  async updateServicio(id: string, dto: Partial<CreateServicioDto>) {
    return this.prisma.servicioCatalogo.update({ where: { id }, data: dto });
  }

  // ─── Dashboard de administración ──────────────────────────
  async getDashboard(sedeId: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const [
      citasHoy,
      pacientesActivos,
      medicoActivos,
      facturasPendientes,
      foliosBajos,
    ] = await Promise.all([
      this.prisma.cita.count({
        where: { sedeId, fechaInicio: { gte: hoy, lt: manana }, estado: { notIn: ['CANCELADA', 'NO_SHOW'] } },
      }),
      this.prisma.paciente.count({ where: { sedeId, activo: true } }),
      this.prisma.medico.count({ where: { usuario: { sedeId }, activo: true } }),
      this.prisma.factura.count({ where: { sedeId, estadoPago: 'PENDIENTE', estadoCfdi: 'TIMBRADO' } }),
      this.prisma.medico.findMany({
        where: { usuario: { sedeId }, activo: true },
        select: { id: true, foliosCofepris: true, usuario: { select: { nombre: true, apellidoPaterno: true } } },
      }).then(medicos => medicos.filter(m => m.foliosCofepris.length < 3)),
    ]);

    return {
      hoy: hoy.toISOString().substring(0, 10),
      citasHoy,
      pacientesActivos,
      medicoActivos,
      facturasPendientes,
      alertas: {
        foliosBajos: foliosBajos.map(m => ({
          medicoId: m.id,
          nombre: `${m.usuario.nombre} ${m.usuario.apellidoPaterno}`,
          foliosRestantes: m.foliosCofepris.length,
        })),
      },
    };
  }

  // ─── Activación de integraciones ─────────────────────────
  async getIntegrationsStatus(sedeId: string) {
    const sede = await this.prisma.sede.findUniqueOrThrow({ where: { id: sedeId } });
    return {
      whatsapp: {
        enabled: process.env.WHATSAPP_ENABLED === 'true',
        configured: !!sede.whatsappPhoneNumberId,
      },
      quickbooks: {
        enabled: process.env.QB_SYNC_ENABLED === 'true',
        configured: !!sede.qbRealmId,
        syncPending: await this.prisma.factura.count({ where: { sedeId, qbSyncPending: true } }),
      },
      daily: {
        configured: !!sede.dailyApiKey || !!process.env.DAILY_API_KEY,
      },
      pac: {
        configured: !!sede.pacUrl || !!process.env.PAC_URL,
      },
    };
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('dashboard')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Dashboard de administración de la sede' })
  async getDashboard(@SedeId() s: string) {
    return this.svc.getDashboard(s);
  }

  @Get('sede')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Configuración de la sede' })
  async getSede(@SedeId() s: string) {
    return this.svc.getSede(s);
  }

  @Patch('sede')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Actualizar configuración de la sede' })
  async updateSede(@Body() dto: UpdateSedeDto, @SedeId() s: string, @CurrentUser() u: any, @ClientIp() ip: string) {
    return this.svc.updateSede(s, dto, u.userId, ip);
  }

  @Get('medicos')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Listar médicos activos de la sede' })
  async getMedicos(@SedeId() s: string) {
    return this.svc.getMedicos(s);
  }

  @Post('medicos/folios-cofepris')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agregar folios COFEPRIS para recetas de estupefacientes' })
  async addFolios(@Body() dto: AddFoliosDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.addFoliosCofepris(dto, u.userId, s, ip);
  }

  @Get('services')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Catálogo de servicios (para facturación)' })
  async getServices(@Query('q') q?: string) {
    return this.svc.getServicios(q);
  }

  @Post('services')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Crear nuevo servicio en el catálogo' })
  async createService(@Body() dto: CreateServicioDto, @CurrentUser() u: any) {
    return this.svc.createServicio(dto, u.userId);
  }

  @Patch('services/:id')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Actualizar servicio del catálogo' })
  async updateService(@Param('id') id: string, @Body() dto: Partial<CreateServicioDto>) {
    return this.svc.updateServicio(id, dto);
  }

  @Get('integrations')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Estado de integraciones (WhatsApp, QB, PAC, Daily.co)' })
  async getIntegrations(@SedeId() s: string) {
    return this.svc.getIntegrationsStatus(s);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
  exports: [AdminService],
})
export class AdminModule {}
