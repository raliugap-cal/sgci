// ═══════════════════════════════════════════════════════════
// HCE MODULE — Historia Clínica Electrónica NOM-004-SSA3
// Notas SOAP · Signos Vitales · Diagnósticos CIE-10
// ═══════════════════════════════════════════════════════════
import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common';
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, ClientIp, SedeId } from '../auth/strategies/jwt.strategy';
import { Rol, EstadoConsulta, TipoNota } from '@prisma/client';
import { PrismaModule } from '../database/prisma.module';
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  Min, Max, IsArray, IsUUID,
} from 'class-validator';

// ─── DTOs ────────────────────────────────────────────────
class CreateConsultaDto {
  @IsUUID() citaId: string;
}

class CreateNotaDto {
  @IsUUID() consultaId: string;
  @IsEnum(TipoNota) tipoNota: TipoNota;
  @IsOptional() @IsUUID() plantillaId?: string;
  @IsOptional() @IsString() subjetivo?: string;
  @IsOptional() @IsString() objetivo?: string;
  @IsOptional() @IsString() evaluacion?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsString() padecimientoActual?: string;
  @IsOptional() @IsString() exploracionFisica?: string;
  @IsOptional() @IsString() planTerapeutico?: string;
  @IsOptional() @IsString() pronostico?: string;
  @IsOptional() @IsBoolean() creadaOffline?: boolean;
  @IsOptional() @IsString() deviceId?: string;
}

class UpdateNotaDto {
  @IsOptional() @IsString() subjetivo?: string;
  @IsOptional() @IsString() objetivo?: string;
  @IsOptional() @IsString() evaluacion?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsString() padecimientoActual?: string;
  @IsOptional() @IsString() exploracionFisica?: string;
  @IsOptional() @IsString() planTerapeutico?: string;
  @IsOptional() @IsString() pronostico?: string;
}

class SignNotaDto {
  // En v2 la firma es hash SHA-256 del contenido; no requiere e.firma SAT
}

class CreateSignosVitalesDto {
  @IsUUID() consultaId: string;
  @IsOptional() @IsNumber() @Min(1) @Max(300) pesoKg?: number;
  @IsOptional() @IsNumber() @Min(50) @Max(250) tallaCm?: number;
  @IsOptional() @IsNumber() @Min(50) @Max(250) taSistolica?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(150) taDiastolica?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(250) fcLpm?: number;
  @IsOptional() @IsNumber() @Min(5) @Max(60) frRpm?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(43) temperaturaC?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) spo2Pct?: number;
  @IsOptional() @IsNumber() glucosaMgdl?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) dolorEscala?: number;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() creadaOffline?: boolean;
}

class CreateDiagnosticoDto {
  @IsUUID() consultaId: string;
  @IsString() cie10Id: string;
  @IsString() tipo: string;  // principal, secundario, asociado
  @IsString() estado: string; // activo, resuelto, cronico, en_estudio
  @IsOptional() @IsString() notas?: string;
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class HceService {
  private readonly logger = new Logger(HceService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private audit: AuditService,
  ) {}

  // ─── Abrir consulta desde cita ──────────────────────────
  async openConsulta(dto: CreateConsultaDto, medicoId: string, sedeId: string, actorId: string, ip: string) {
    const cita = await this.prisma.cita.findFirst({
      where: { id: dto.citaId, sedeId, medicoId },
    });
    if (!cita) throw new NotFoundException('Cita no encontrada o no asignada a este médico');

    // Verificar que no haya ya una consulta abierta
    const existing = await this.prisma.consulta.findUnique({ where: { citaId: dto.citaId } });
    if (existing) return existing;

    const consulta = await this.prisma.consulta.create({
      data: {
        citaId: dto.citaId,
        pacienteId: cita.pacienteId,
        medicoId,
        sedeId,
        esTelemedicina: cita.esTelemedicina,
        estado: EstadoConsulta.EN_PROGRESO,
        inicioAtencion: new Date(),
        actorId,
      },
    });

    // Actualizar estado de la cita
    await this.prisma.cita.update({
      where: { id: dto.citaId },
      data: { estado: 'EN_CONSULTA' },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'OPEN_CONSULTA', recursoTipo: 'consulta', recursoId: consulta.id });
    return consulta;
  }

  // ─── Cerrar y firmar consulta ───────────────────────────
  async closeConsulta(consultaId: string, medicoId: string, sedeId: string, actorId: string, ip: string) {
    const consulta = await this.prisma.consulta.findFirst({ where: { id: consultaId, medicoId, sedeId } });
    if (!consulta) throw new NotFoundException('Consulta no encontrada');
    if (consulta.estado === EstadoConsulta.FIRMADA) throw new BadRequestException('Consulta ya está firmada');

    // Verificar que tiene al menos una nota
    const notas = await this.prisma.notaClinica.count({ where: { consultaId } });
    if (notas === 0) throw new BadRequestException('La consulta debe tener al menos una nota clínica antes de cerrar');

    const updated = await this.prisma.consulta.update({
      where: { id: consultaId },
      data: { estado: EstadoConsulta.FIRMADA, finAtencion: new Date(), actorId },
    });

    // Actualizar cita a completada
    await this.prisma.cita.update({ where: { id: consulta.citaId }, data: { estado: 'COMPLETADA' } });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CLOSE_CONSULTA', recursoTipo: 'consulta', recursoId: consultaId });
    return updated;
  }

  // ─── Crear nota clínica ─────────────────────────────────
  async createNota(dto: CreateNotaDto, medicoId: string, sedeId: string, actorId: string, ip: string) {
    // Verificar acceso a la consulta
    const consulta = await this.prisma.consulta.findFirst({
      where: { id: dto.consultaId, sedeId },
    });
    if (!consulta) throw new NotFoundException('Consulta no encontrada');
    if (consulta.estado === EstadoConsulta.FIRMADA) {
      throw new ForbiddenException('No se puede agregar notas a una consulta firmada');
    }

    const nota = await this.prisma.notaClinica.create({
      data: {
        consultaId: dto.consultaId,
        medicoId,
        plantillaId: dto.plantillaId,
        tipoNota: dto.tipoNota,
        subjetivo: dto.subjetivo,
        objetivo: dto.objetivo,
        evaluacion: dto.evaluacion,
        plan: dto.plan,
        padecimientoActual: dto.padecimientoActual,
        exploracionFisica: dto.exploracionFisica,
        planTerapeutico: dto.planTerapeutico,
        pronostico: dto.pronostico,
        creadaOffline: dto.creadaOffline ?? false,
        deviceId: dto.deviceId,
        actorId,
      },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE', recursoTipo: 'nota_clinica', recursoId: nota.id });
    return nota;
  }

  // ─── Actualizar nota ────────────────────────────────────
  async updateNota(notaId: string, dto: UpdateNotaDto, medicoId: string, sedeId: string, actorId: string) {
    const nota = await this.prisma.notaClinica.findFirst({ where: { id: notaId, medicoId } });
    if (!nota) throw new NotFoundException('Nota no encontrada');
    if (nota.firmada) throw new ForbiddenException('No se puede modificar una nota firmada');

    // Versionar la nota antes de actualizar
    await this.prisma.versionNota.create({
      data: {
        notaId,
        version: nota.version,
        contenido: { subjetivo: nota.subjetivo, objetivo: nota.objetivo, evaluacion: nota.evaluacion, plan: nota.plan },
        actorId,
      },
    });

    return this.prisma.notaClinica.update({
      where: { id: notaId },
      data: { ...dto, version: { increment: 1 }, actorId },
    });
  }

  // ─── Firmar nota ────────────────────────────────────────
  async signNota(notaId: string, medicoId: string, sedeId: string, actorId: string, ip: string) {
    const nota = await this.prisma.notaClinica.findFirst({ where: { id: notaId, medicoId } });
    if (!nota) throw new NotFoundException('Nota no encontrada o no pertenece a este médico');
    if (nota.firmada) throw new BadRequestException('La nota ya está firmada');

    // Generar hash del contenido (firma digital simple v1)
    const contenido = JSON.stringify({
      subjetivo: nota.subjetivo, objetivo: nota.objetivo,
      evaluacion: nota.evaluacion, plan: nota.plan,
      medicoId, timestamp: new Date().toISOString(),
    });
    const firmaHash = this.encryption.signContent(contenido, medicoId);

    const signed = await this.prisma.notaClinica.update({
      where: { id: notaId },
      data: { firmada: true, firmaHash, firmadaAt: new Date(), actorId },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'SIGN', recursoTipo: 'nota_clinica', recursoId: notaId, datosNuevos: { firmaHash } });
    return signed;
  }

  // ─── Signos vitales ─────────────────────────────────────
  async upsertSignosVitales(dto: CreateSignosVitalesDto, actorId: string, sedeId: string) {
    const imc = dto.pesoKg && dto.tallaCm
      ? Number((dto.pesoKg / Math.pow(dto.tallaCm / 100, 2)).toFixed(1))
      : undefined;

    return this.prisma.signosVitales.upsert({
      where: { consultaId: dto.consultaId },
      create: {
        consultaId: dto.consultaId,
        capturadoPorId: actorId,
        pesoKg: dto.pesoKg,
        tallaCm: dto.tallaCm,
        imc,
        taSistolica: dto.taSistolica,
        taDiastolica: dto.taDiastolica,
        fcLpm: dto.fcLpm,
        frRpm: dto.frRpm,
        temperaturaC: dto.temperaturaC,
        spo2Pct: dto.spo2Pct,
        glucosaMgdl: dto.glucosaMgdl,
        dolorEscala: dto.dolorEscala,
        notas: dto.notas,
        creadaOffline: dto.creadaOffline ?? false,
      },
      update: {
        pesoKg: dto.pesoKg,
        tallaCm: dto.tallaCm,
        imc,
        taSistolica: dto.taSistolica,
        taDiastolica: dto.taDiastolica,
        fcLpm: dto.fcLpm,
        frRpm: dto.frRpm,
        temperaturaC: dto.temperaturaC,
        spo2Pct: dto.spo2Pct,
        glucosaMgdl: dto.glucosaMgdl,
        dolorEscala: dto.dolorEscala,
        notas: dto.notas,
      },
    });
  }

  // ─── Diagnósticos CIE-10 ────────────────────────────────
  async addDiagnostico(dto: CreateDiagnosticoDto, actorId: string, sedeId: string) {
    // Verificar que el código CIE-10 existe
    const cie10 = await this.prisma.codigoCIE10.findUnique({ where: { codigo: dto.cie10Id } })
      ?? await this.prisma.codigoCIE10.findFirst({ where: { codigo: { startsWith: dto.cie10Id } } });

    if (!cie10) throw new NotFoundException(`Código CIE-10 no encontrado: ${dto.cie10Id}`);

    return this.prisma.diagnostico.create({
      data: {
        consultaId: dto.consultaId,
        cie10Id: cie10.id,
        tipo: dto.tipo,
        estado: dto.estado,
        notas: dto.notas,
        actorId,
      },
      include: { cie10: true },
    });
  }

  // ─── Búsqueda CIE-10 ────────────────────────────────────
  async searchCie10(q: string) {
    return this.prisma.codigoCIE10.findMany({
      where: {
        OR: [
          { codigo: { startsWith: q.toUpperCase() } },
          { descripcion: { contains: q, mode: 'insensitive' } },
        ],
        activo: true,
      },
      take: 20,
      orderBy: { codigo: 'asc' },
    });
  }

  // ─── Plantillas clínicas ─────────────────────────────────
  async getPlantillas(especialidadId?: string, tipoNota?: TipoNota) {
    return this.prisma.plantillaClinica.findMany({
      where: {
        activa: true,
        ...(especialidadId && { especialidadId }),
        ...(tipoNota && { tipoNota }),
      },
      include: { especialidad: true },
      orderBy: { nombre: 'asc' },
    });
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('consultations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hce')
export class HceController {
  constructor(private hceService: HceService) {}

  // Consultas
  @Post('consultas')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Abrir consulta desde cita' })
  async openConsulta(
    @Body() dto: CreateConsultaDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.hceService.openConsulta(dto, user.medicoId, sedeId, user.userId, ip);
  }

  @Post('consultas/:id/close')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar y firmar consulta (NOM-004)' })
  async closeConsulta(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.hceService.closeConsulta(id, user.medicoId, sedeId, user.userId, ip);
  }

  // Notas
  @Post('notas')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.ENFERMERIA, Rol.TRABAJO_SOCIAL, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Crear nota clínica SOAP/NOM-004' })
  async createNota(
    @Body() dto: CreateNotaDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.hceService.createNota(dto, user.medicoId, sedeId, user.userId, ip);
  }

  @Patch('notas/:id')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.ENFERMERIA, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar nota (solo si no está firmada)' })
  async updateNota(
    @Param('id') id: string,
    @Body() dto: UpdateNotaDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
  ) {
    return this.hceService.updateNota(id, dto, user.medicoId, sedeId, user.userId);
  }

  @Post('notas/:id/sign')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Firmar nota digitalmente (NOM-004 — firma simple SHA-256)' })
  async signNota(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.hceService.signNota(id, user.medicoId, sedeId, user.userId, ip);
  }

  // Signos Vitales
  @Post('vitals')
  @Roles(Rol.MEDICO, Rol.ENFERMERIA, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Registrar / actualizar signos vitales' })
  async upsertVitals(
    @Body() dto: CreateSignosVitalesDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
  ) {
    return this.hceService.upsertSignosVitales(dto, user.userId, sedeId);
  }

  // Diagnósticos
  @Post('diagnoses')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Agregar diagnóstico CIE-10' })
  async addDiagnosis(
    @Body() dto: CreateDiagnosticoDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
  ) {
    return this.hceService.addDiagnostico(dto, user.userId, sedeId);
  }

  @Get('cie10/search')
  @ApiOperation({ summary: 'Buscar códigos CIE-10' })
  async searchCie10(@Query('q') q: string) {
    return this.hceService.searchCie10(q);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar plantillas clínicas por especialidad' })
  async getTemplates(
    @Query('especialidadId') especialidadId?: string,
    @Query('tipoNota') tipoNota?: TipoNota,
  ) {
    return this.hceService.getPlantillas(especialidadId, tipoNota);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [HceController],
  providers: [HceService, EncryptionService, AuditService],
  exports: [HceService],
})
export class HceModule {}
