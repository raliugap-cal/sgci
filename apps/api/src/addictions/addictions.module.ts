// ═══════════════════════════════════════════════════════════
// ADDICTIONS MODULE — NOM-028-SSA2
// Expediente · PTI · Instrumentos AUDIT/DAST · Sesiones · Diario
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol, ModalidadTratamiento, EstadoTratamiento } from '@prisma/client';
import { PrismaModule } from '../database/prisma.module';
import {
  IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsUUID,
  IsEnum, IsDateString, Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── DTOs ────────────────────────────────────────────────
class CreateExpedienteAdiccionDto {
  @IsUUID() pacienteId: string;
  @IsUUID() medicoResponsableId: string;
  @IsOptional() @IsUUID() psicologoId?: string;
  @IsOptional() @IsUUID() trabajadorSocialId?: string;
  @IsEnum(ModalidadTratamiento) modalidad: ModalidadTratamiento;
  @IsString() sustanciaPrincipal: string;
  @IsOptional() @IsArray() @IsString({ each: true }) sustanciasSecundarias?: string[];
  @IsOptional() @IsNumber() edadInicio?: number;
  @IsOptional() @IsString() patronConsumo?: string;
  @IsString() motivoConsulta: string;
  @IsOptional() @IsString() historiaSocial?: string;
  @IsOptional() @IsString() redApoyo?: string;
}

class CreatePlanTratamientoDto {
  @IsUUID() expedienteAdiccionId: string;
  @IsString() diagnosticoCie10: string;
  @IsString() objetivoGeneral: string;
  @IsArray() @IsString({ each: true }) objetivosEspecificos: string[];
  @IsEnum(ModalidadTratamiento) modalidad: ModalidadTratamiento;
  @IsArray() @IsString({ each: true }) intervenciones: string[];
  @IsOptional() @IsNumber() @Min(0) @Max(7) sesionesSemMedico?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(7) sesionesSemPsico?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(7) sesionesSemGrupal?: number;
  @IsOptional() @IsNumber() duracionMeses?: number;
  @IsDateString() fechaInicio: string;
  @IsDateString() fechaRevision: string;
}

class AplicarInstrumentoDto {
  @IsUUID() expedienteAdiccionId: string;
  @IsUUID() instrumentoId: string;
  @IsArray() respuestas: any[];
}

class CreateNotaSesionDto {
  @IsUUID() expedienteAdiccionId: string;
  @IsString() tipoSesion: string;
  @IsString() objetivosSesion: string;
  @IsString() contenido: string;
  @IsOptional() @IsString() logros?: string;
  @IsOptional() @IsString() tareas?: string;
  @IsOptional() @IsString() proximaSesion?: string;
  @IsOptional() @IsBoolean() huboConsumo?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) sustanciasConsumo?: string[];
}

class CreateDiarioDto {
  @IsUUID() expedienteAdiccionId: string;
  @IsDateString() fecha: string;
  @IsBoolean() huboConsumo: boolean;
  @IsOptional() @IsArray() sustancias?: { sustancia: string; cantidad: number; unidad: string }[];
  @IsOptional() @IsNumber() @Min(1) @Max(10) estadoAnimo?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(10) nivelAnsiedad?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) factoresRiesgo?: string[];
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() creadoOffline?: boolean;
  @IsOptional() @IsString() timestampLocal?: string;
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class AddictionsService {
  private readonly logger = new Logger(AddictionsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Crear expediente de adicciones ─────────────────────
  async createExpediente(dto: CreateExpedienteAdiccionDto, actorId: string, sedeId: string, ip: string) {
    // Verificar que el paciente no tenga ya un expediente
    const existing = await this.prisma.expedienteAdiccion.findFirst({
      where: { pacienteId: dto.pacienteId },
    });
    if (existing) throw new ConflictException('El paciente ya tiene un expediente de adicciones');

    const expediente = await this.prisma.expedienteAdiccion.create({
      data: {
        pacienteId: dto.pacienteId,
        medicoResponsableId: dto.medicoResponsableId,
        psicologoId: dto.psicologoId,
        trabajadorSocialId: dto.trabajadorSocialId,
        modalidad: dto.modalidad,
        sustanciaPrincipal: dto.sustanciaPrincipal,
        sustanciasSecundarias: dto.sustanciasSecundarias ?? [],
        edadInicio: dto.edadInicio,
        patronConsumo: dto.patronConsumo,
        motivoConsulta: dto.motivoConsulta,
        historiaSocial: dto.historiaSocial,
        redApoyo: dto.redApoyo,
        estadoTratamiento: EstadoTratamiento.EN_EVALUACION,
        actorId,
      },
      include: { paciente: true, medicoResponsable: { include: { usuario: true } } },
    });

    // Marcar en el paciente
    await this.prisma.paciente.update({
      where: { id: dto.pacienteId },
      data: { tieneExpedienteAdicciones: true },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE', recursoTipo: 'expediente_adiccion', recursoId: expediente.id });
    return expediente;
  }

  // ─── Plan de Tratamiento Individual ─────────────────────
  async createPlan(dto: CreatePlanTratamientoDto, actorId: string, sedeId: string, ip: string) {
    const expediente = await this.prisma.expedienteAdiccion.findUniqueOrThrow({
      where: { id: dto.expedienteAdiccionId },
    });

    // Obtener versión del plan anterior para versionar
    const planActivo = await this.prisma.planTratamiento.findFirst({
      where: { expedienteAdiccionId: dto.expedienteAdiccionId, estado: 'activo' },
    });

    if (planActivo) {
      await this.prisma.planTratamiento.update({ where: { id: planActivo.id }, data: { estado: 'revisado' } });
    }

    const version = planActivo ? planActivo.version + 1 : 1;

    const plan = await this.prisma.planTratamiento.create({
      data: {
        expedienteAdiccionId: dto.expedienteAdiccionId,
        elaboradoPorId: actorId,
        version,
        diagnosticoCie10: dto.diagnosticoCie10,
        objetivoGeneral: dto.objetivoGeneral,
        objetivosEspecificos: dto.objetivosEspecificos,
        modalidad: dto.modalidad,
        intervenciones: dto.intervenciones,
        sesionesSemMedico: dto.sesionesSemMedico ?? 1,
        sesionesSemPsico: dto.sesionesSemPsico ?? 1,
        sesionesSemGrupal: dto.sesionesSemGrupal ?? 0,
        duracionMeses: dto.duracionMeses,
        fechaInicio: new Date(dto.fechaInicio),
        fechaRevision: new Date(dto.fechaRevision),
        estado: 'activo',
        actorId,
      },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE_PTI', recursoTipo: 'plan_tratamiento', recursoId: plan.id });
    return plan;
  }

  // ─── Aplicar instrumento (AUDIT, DAST-10, etc.) ─────────
  async aplicarInstrumento(dto: AplicarInstrumentoDto, actorId: string, sedeId: string) {
    const instrumento = await this.prisma.instrumento.findUniqueOrThrow({
      where: { id: dto.instrumentoId },
    });

    const preguntas: any[] = instrumento.preguntas as any[];
    const criterios: any = instrumento.criterios;

    // Calcular puntaje
    let puntaje = 0;
    for (let i = 0; i < dto.respuestas.length; i++) {
      const pregunta = preguntas[i];
      const respuesta = dto.respuestas[i];
      if (pregunta && respuesta !== undefined) {
        const opcion = pregunta.opciones?.find((o: any) => o.valor === respuesta);
        puntaje += opcion?.puntaje ?? 0;
      }
    }

    // Interpretar según criterios del instrumento
    let interpretacion = 'Sin clasificar';
    for (const criterio of Object.values(criterios) as any[]) {
      if (puntaje >= criterio.minimo && puntaje <= criterio.maximo) {
        interpretacion = criterio.descripcion;
        break;
      }
    }

    return this.prisma.instrumentoAplicado.create({
      data: {
        expedienteAdiccionId: dto.expedienteAdiccionId,
        instrumentoId: dto.instrumentoId,
        aplicadoPorId: actorId,
        respuestas: dto.respuestas,
        puntaje,
        interpretacion,
      },
      include: { instrumento: true },
    });
  }

  // ─── Nota de sesión ─────────────────────────────────────
  async createNotaSesion(dto: CreateNotaSesionDto, actorId: string, sedeId: string) {
    return this.prisma.notaSesion.create({
      data: {
        expedienteAdiccionId: dto.expedienteAdiccionId,
        registradoPorId: actorId,
        tipoSesion: dto.tipoSesion,
        objetivosSesion: dto.objetivosSesion,
        contenido: dto.contenido,
        logros: dto.logros,
        tareas: dto.tareas,
        proximaSesion: dto.proximaSesion,
        huboConsumo: dto.huboConsumo,
        sustonciasConsumo: dto.sustanciasConsumo ?? [],
        actorId,
      },
    });
  }

  // ─── Diario de consumo (offline-ready) ──────────────────
  async createDiario(dto: CreateDiarioDto, pacienteId: string) {
    const expediente = await this.prisma.expedienteAdiccion.findFirst({
      where: { id: dto.expedienteAdiccionId, pacienteId },
    });
    if (!expediente) throw new NotFoundException('Expediente no pertenece al paciente');

    // Verificar duplicado del día
    const existing = await this.prisma.diarioConsumo.findFirst({
      where: { expedienteAdiccionId: dto.expedienteAdiccionId, fecha: new Date(dto.fecha) },
    });
    if (existing) {
      return this.prisma.diarioConsumo.update({
        where: { id: existing.id },
        data: {
          huboConsumo: dto.huboConsumo,
          sustancias: dto.sustancias ?? [],
          estadoAnimo: dto.estadoAnimo,
          nivelAnsiedad: dto.nivelAnsiedad,
          factoresRiesgo: dto.factoresRiesgo ?? [],
          notas: dto.notas,
        },
      });
    }

    return this.prisma.diarioConsumo.create({
      data: {
        expedienteAdiccionId: dto.expedienteAdiccionId,
        fecha: new Date(dto.fecha),
        huboConsumo: dto.huboConsumo,
        sustancias: dto.sustancias ?? [],
        estadoAnimo: dto.estadoAnimo,
        nivelAnsiedad: dto.nivelAnsiedad,
        factoresRiesgo: dto.factoresRiesgo ?? [],
        notas: dto.notas,
        creadoOffline: dto.creadoOffline ?? false,
        timestampLocal: dto.timestampLocal ? new Date(dto.timestampLocal) : null,
        syncPending: false,
      },
    });
  }

  // ─── Obtener expediente completo ─────────────────────────
  async getExpediente(expedienteId: string) {
    return this.prisma.expedienteAdiccion.findUniqueOrThrow({
      where: { id: expedienteId },
      include: {
        paciente: true,
        medicoResponsable: { include: { usuario: true } },
        planesT: { orderBy: { version: 'desc' }, take: 1 },
        instrumentos: { include: { instrumento: true }, orderBy: { aplicadoAt: 'desc' } },
        diario: { orderBy: { fecha: 'desc' }, take: 30 },
        notasSesion: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  // ─── Dashboard de evolución ──────────────────────────────
  async getDashboard(expedienteId: string) {
    const [diario, instrumentos, sesiones] = await Promise.all([
      this.prisma.diarioConsumo.findMany({
        where: { expedienteAdiccionId: expedienteId },
        orderBy: { fecha: 'desc' },
        take: 30,
      }),
      this.prisma.instrumentoAplicado.findMany({
        where: { expedienteAdiccionId: expedienteId },
        include: { instrumento: true },
        orderBy: { aplicadoAt: 'asc' },
      }),
      this.prisma.notaSesion.count({ where: { expedienteAdiccionId: expedienteId } }),
    ]);

    const diasSinConsumo = diario.filter(d => !d.huboConsumo).length;
    const diasConConsumo = diario.filter(d => d.huboConsumo).length;
    const estadoAnimoPromedio = diario.reduce((s, d) => s + (d.estadoAnimo ?? 0), 0) / (diario.length || 1);

    return { diasSinConsumo, diasConConsumo, estadoAnimoPromedio, instrumentos, totalSesiones: sesiones, diario };
  }

  // ─── Listado de instrumentos disponibles ─────────────────
  async getInstrumentos() {
    return this.prisma.instrumento.findMany({ where: { activo: true } });
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('addictions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addictions')
export class AddictionsController {
  constructor(private svc: AddictionsService) {}

  @Post('expedientes')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.TRABAJO_SOCIAL, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Abrir expediente de adicciones NOM-028' })
  async createExpediente(@Body() dto: CreateExpedienteAdiccionDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.createExpediente(dto, u.userId, s, ip);
  }

  @Get('expedientes/:id')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.TRABAJO_SOCIAL, Rol.SUPERADMIN)
  async getExpediente(@Param('id') id: string) {
    return this.svc.getExpediente(id);
  }

  @Get('expedientes/:id/dashboard')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.TRABAJO_SOCIAL, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Dashboard de evolución: días sin consumo, estado de ánimo, progreso' })
  async getDashboard(@Param('id') id: string) {
    return this.svc.getDashboard(id);
  }

  @Post('plans')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Crear/actualizar Plan de Tratamiento Individual (PTI)' })
  async createPlan(@Body() dto: CreatePlanTratamientoDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.createPlan(dto, u.userId, s, ip);
  }

  @Post('instruments/apply')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Aplicar instrumento (AUDIT, DAST-10, ASSIST, CAGE)' })
  async applyInstrument(@Body() dto: AplicarInstrumentoDto, @CurrentUser() u: any, @SedeId() s: string) {
    return this.svc.aplicarInstrumento(dto, u.userId, s);
  }

  @Get('instruments')
  @ApiOperation({ summary: 'Listar instrumentos disponibles' })
  async getInstruments() {
    return this.svc.getInstrumentos();
  }

  @Post('sessions')
  @Roles(Rol.MEDICO, Rol.PSICOLOGO, Rol.TRABAJO_SOCIAL, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Registrar nota de sesión (individual/grupal/familiar)' })
  async createSession(@Body() dto: CreateNotaSesionDto, @CurrentUser() u: any, @SedeId() s: string) {
    return this.svc.createNotaSesion(dto, u.userId, s);
  }

  @Post('diary')
  @ApiOperation({ summary: 'Registrar entrada del diario de consumo (offline-ready)' })
  async createDiary(@Body() dto: CreateDiarioDto, @CurrentUser() u: any) {
    return this.svc.createDiario(dto, u.userId);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule],
  controllers: [AddictionsController],
  providers: [AddictionsService, AuditService],
  exports: [AddictionsService],
})
export class AddictionsModule {}
