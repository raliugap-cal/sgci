// ═══════════════════════════════════════════════════════════
// PRESCRIPTIONS MODULE — Recetas COFEPRIS
// Ordinarias · Especiales · Controladas (estupefacientes)
// PDF con QR de verificación
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FilesService } from '../files/files.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol, TipoReceta, EstadoReceta } from '@prisma/client';
import { PrismaModule } from '../database/prisma.module';
import { generateRecetaNumber } from '../common/services/audit.service';
import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsUUID, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import * as QRCode from 'qrcode';

// ─── DTOs ────────────────────────────────────────────────
class ItemRecetaDto {
  @IsOptional() @IsUUID() medicamentoId?: string;
  @IsString() medicamentoDci: string;
  @IsOptional() @IsString() medicamentoNombreComercial?: string;
  @IsOptional() @IsString() presentacion?: string;
  @IsString() dosis: string;
  @IsString() viaAdministracion: string;
  @IsString() frecuencia: string;
  @IsOptional() @IsNumber() duracionDias?: number;
  @IsOptional() @IsNumber() cantidadTotal?: number;
  @IsOptional() @IsString() indicacionesPaciente?: string;
  @IsOptional() @IsBoolean() esControlado?: boolean;
}

class CreateRecetaDto {
  @IsUUID() pacienteId: string;
  @IsOptional() @IsUUID() consultaId?: string;
  @IsEnum(TipoReceta) tipoReceta: TipoReceta;
  @IsOptional() @IsString() folioCofepris?: string; // Solo controladas
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemRecetaDto) items: ItemRecetaDto[];
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  // ─── Crear receta ────────────────────────────────────────
  async create(dto: CreateRecetaDto, medicoId: string, sedeId: string, actorId: string, ip: string) {
    const medico = await this.prisma.medico.findFirst({
      where: { id: medicoId },
      include: { usuario: true },
    });
    if (!medico) throw new NotFoundException('Médico no encontrado');

    // Validaciones especiales para controladas
    if (dto.tipoReceta === TipoReceta.ESTUPEFACIENTE) {
      if (!medico.habilitadoControlados) {
        throw new ForbiddenException('El médico no está habilitado para prescribir estupefacientes');
      }
      if (!dto.folioCofepris && medico.foliosCofepris.length === 0) {
        throw new BadRequestException('No hay folios COFEPRIS disponibles para estupefacientes');
      }
    }

    // Obtener/consumir folio COFEPRIS para controladas
    let folioCofepris = dto.folioCofepris;
    if (dto.tipoReceta !== TipoReceta.ORDINARIA && !folioCofepris && medico.foliosCofepris.length > 0) {
      folioCofepris = medico.foliosCofepris[0];
      // Consumir el folio
      await this.prisma.medico.update({
        where: { id: medicoId },
        data: { foliosCofepris: medico.foliosCofepris.slice(1) },
      });
    }

    // Verificar interacciones medicamentosas con alergias del paciente
    const alertas = await this.checkAlergias(dto.pacienteId, dto.items);

    // Generar número de receta
    const numeroReceta = generateRecetaNumber(dto.tipoReceta);

    // Generar QR de verificación
    const qrData = `https://verificar.clinica.mx/receta/${numeroReceta}`;
    const qrBase64 = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });

    const receta = await this.prisma.receta.create({
      data: {
        pacienteId: dto.pacienteId,
        consultaId: dto.consultaId,
        medicoId,
        sedeId,
        tipoReceta: dto.tipoReceta,
        folioCofepris,
        numeroReceta,
        estado: EstadoReceta.ACTIVA,
        qrVerificacion: qrBase64,
        actorId,
        items: {
          create: dto.items.map(item => ({
            medicamentoId: item.medicamentoId,
            medicamentoDci: item.medicamentoDci,
            medicamentoNombreComercial: item.medicamentoNombreComercial,
            presentacion: item.presentacion,
            dosis: item.dosis,
            viaAdministracion: item.viaAdministracion,
            frecuencia: item.frecuencia,
            duracionDias: item.duracionDias,
            cantidadTotal: item.cantidadTotal,
            indicacionesPaciente: item.indicacionesPaciente,
            esControlado: item.esControlado ?? dto.tipoReceta !== TipoReceta.ORDINARIA,
            alertaContraindicacion: alertas.some(a => a.medicamentoDci === item.medicamentoDci),
            alertaDetalle: alertas.find(a => a.medicamentoDci === item.medicamentoDci)?.alerta,
          })),
        },
      },
      include: {
        items: { include: { medicamento: true } },
        medico: { include: { usuario: true } },
        paciente: true,
      },
    });

    // Generar PDF de receta
    const pdfBuffer = await this.generatePdf(receta, medico);
    const pdfKey = `recetas/${sedeId}/${new Date().getFullYear()}/${numeroReceta}.pdf`;
    const pdfUrl = await this.files.upload(pdfBuffer, pdfKey, 'application/pdf');

    await this.prisma.receta.update({ where: { id: receta.id }, data: { pdfUrl } });

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'CREATE',
      recursoTipo: 'receta',
      recursoId: receta.id,
      datosNuevos: { tipoReceta: dto.tipoReceta, folioCofepris, numeroReceta, alertas: alertas.length },
    });

    return { ...receta, pdfUrl, alertas };
  }

  // ─── Obtener receta ──────────────────────────────────────
  async findById(recetaId: string, sedeId: string) {
    const receta = await this.prisma.receta.findFirst({
      where: { id: recetaId, sedeId },
      include: {
        items: { include: { medicamento: true } },
        medico: { include: { usuario: true, especialidades: { include: { especialidad: true } } } },
        paciente: true,
      },
    });
    if (!receta) throw new NotFoundException('Receta no encontrada');
    return receta;
  }

  // ─── Marcar como dispensada ──────────────────────────────
  async dispense(recetaId: string, actorId: string, sedeId: string, ip: string) {
    const receta = await this.prisma.receta.findFirst({ where: { id: recetaId, sedeId } });
    if (!receta) throw new NotFoundException('Receta no encontrada');
    if (receta.estado !== EstadoReceta.ACTIVA) throw new BadRequestException('La receta no está activa');

    const updated = await this.prisma.receta.update({
      where: { id: recetaId },
      data: { estado: EstadoReceta.DISPENSADA, actorId },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'DISPENSE', recursoTipo: 'receta', recursoId: recetaId });
    return updated;
  }

  // ─── Listar recetas de paciente ──────────────────────────
  async findByPaciente(pacienteId: string, estado?: EstadoReceta, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, recetas] = await Promise.all([
      this.prisma.receta.count({ where: { pacienteId, ...(estado && { estado }) } }),
      this.prisma.receta.findMany({
        where: { pacienteId, ...(estado && { estado }) },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { medicamento: true } }, medico: { include: { usuario: true } } },
      }),
    ]);
    return { data: recetas, meta: { total, page, limit } };
  }

  // ─── Buscar medicamento por nombre/DCI ──────────────────
  async searchMedicamentos(q: string, soloControlados = false) {
    return this.prisma.medicamento.findMany({
      where: {
        activo: true,
        ...(soloControlados && { esControlado: true }),
        OR: [
          { nombreDci: { contains: q, mode: 'insensitive' } },
          { nombreComercial: { contains: q, mode: 'insensitive' } },
          { claveCofepris: { startsWith: q.toUpperCase() } },
        ],
      },
      take: 20,
      orderBy: { nombreDci: 'asc' },
    });
  }

  // ─── Generar PDF de receta ───────────────────────────────
  private async generatePdf(receta: any, medico: any): Promise<Buffer> {
    // En producción: usar pdfkit con el diseño oficial COFEPRIS
    // Aquí se retorna un buffer placeholder
    const content = `
RECETA MÉDICA — SGCI
Número: ${receta.numeroReceta}
Médico: Dr(a). ${medico.usuario.nombre} ${medico.usuario.apellidoPaterno}
Cédula: ${medico.cedulaProfesional}
Paciente: ${receta.paciente.nombre} ${receta.paciente.apellidoPaterno}
Fecha: ${new Date().toLocaleDateString('es-MX')}

MEDICAMENTOS:
${receta.items.map((i: any) => `- ${i.medicamentoDci} ${i.dosis} c/${i.frecuencia} por ${i.duracionDias ?? '?'} días`).join('\n')}

Tipo de Receta: ${receta.tipoReceta}
${receta.folioCofepris ? `Folio COFEPRIS: ${receta.folioCofepris}` : ''}
    `;
    return Buffer.from(content, 'utf-8');
  }

  // ─── Verificar alergias vs medicamentos ─────────────────
  private async checkAlergias(pacienteId: string, items: ItemRecetaDto[]) {
    const alergias = await this.prisma.alergia.findMany({
      where: { pacienteId, activa: true, tipo: 'medicamento' },
    });

    const alertas: { medicamentoDci: string; alerta: string }[] = [];
    for (const item of items) {
      const conflicto = alergias.find(a =>
        item.medicamentoDci.toLowerCase().includes(a.agente.toLowerCase()) ||
        (item.medicamentoNombreComercial ?? '').toLowerCase().includes(a.agente.toLowerCase()),
      );
      if (conflicto) {
        alertas.push({
          medicamentoDci: item.medicamentoDci,
          alerta: `⚠️ ALERGIA REGISTRADA: ${conflicto.agente} — ${conflicto.reaccion ?? 'reacción desconocida'} (${conflicto.severidad ?? 'gravedad desconocida'})`,
        });
      }
    }
    return alertas;
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('prescriptions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private svc: PrescriptionsService) {}

  @Post()
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Crear receta (ordinaria / especial / estupefaciente COFEPRIS)' })
  async create(@Body() dto: CreateRecetaDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.create(dto, u.medicoId, s, u.userId, ip);
  }

  @Get('patients/:pacienteId')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Listar recetas de un paciente' })
  async findByPaciente(
    @Param('pacienteId') id: string,
    @Query('estado') estado?: EstadoReceta,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findByPaciente(id, estado, +page, +limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @SedeId() s: string) {
    return this.svc.findById(id, s);
  }

  @Post(':id/dispense')
  @Roles(Rol.MEDICO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Marcar receta como dispensada' })
  async dispense(@Param('id') id: string, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.dispense(id, u.userId, s, ip);
  }

  @Get('medications/search')
  @ApiOperation({ summary: 'Buscar medicamentos del catálogo COFEPRIS' })
  async searchMeds(@Query('q') q: string, @Query('controlados') controlados?: string) {
    return this.svc.searchMedicamentos(q, controlados === 'true');
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, AuditService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
