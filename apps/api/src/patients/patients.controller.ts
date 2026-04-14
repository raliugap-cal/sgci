// ═══════════════════════════════════════════════════════════
// PATIENTS CONTROLLER
// POST   /api/v1/patients
// GET    /api/v1/patients?q=&curp=&page=&limit=
// GET    /api/v1/patients/:id
// PATCH  /api/v1/patients/:id
// GET    /api/v1/patients/:id/clinical-summary
// GET    /api/v1/patients/:id/timeline
// GET    /api/v1/patients/:id/arco
// POST   /api/v1/patients/:id/activate-portal
// POST   /api/v1/patients/:id/consents/:type/sign
// ═══════════════════════════════════════════════════════════
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, ClientIp, SedeId } from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';
import {
  IsString, IsOptional, IsEnum, IsDateString, IsEmail,
  IsObject, MinLength, IsBoolean,
} from 'class-validator';
import { SexoBiologico, GrupoSanguineo } from '@prisma/client';

// ─── DTOs ────────────────────────────────────────────────
class CreatePatientDto {
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsDateString() fechaNacimiento: string;
  @IsEnum(SexoBiologico) sexo: SexoBiologico;
  @IsOptional() @IsString() generoIdentidad?: string;
  @IsOptional() @IsString() curp?: string;
  @IsOptional() @IsString() rfc?: string;
  @IsOptional() @IsString() regimenFiscal?: string;
  @IsOptional() @IsString() usoCfdi?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() preferenciaMensajeria?: string;
  @IsOptional() @IsObject() direccion?: Record<string, any>;
  @IsOptional() @IsEnum(GrupoSanguineo) grupoSanguineo?: GrupoSanguineo;
  @IsOptional() @IsString() estadoCivil?: string;
  @IsOptional() @IsString() ocupacion?: string;
  @IsOptional() @IsString() escolaridad?: string;
}

class PatientSearchDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() curp?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

class ActivatePortalDto {
  @IsEmail() email: string;
}

class SignConsentDto {
  @IsOptional() @IsString() firmaBase64?: string;
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('patients')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION, Rol.TRABAJO_SOCIAL)
  @ApiOperation({ summary: 'Registrar nuevo paciente (NOM-004 + LFPDPPP)' })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.patientsService.create(dto, user.userId, sedeId, ip);
  }

  @Get()
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION, Rol.TRABAJO_SOCIAL, Rol.ENFERMERIA, Rol.LABORATORIO, Rol.CAJA)
  @ApiOperation({ summary: 'Buscar pacientes' })
  @ApiQuery({ name: 'q', required: false, description: 'Nombre o número de expediente' })
  @ApiQuery({ name: 'curp', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async search(
    @Query() dto: PatientSearchDto,
    @SedeId() sedeId: string,
  ) {
    return this.patientsService.search(dto, sedeId);
  }

  @Get(':id')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION, Rol.TRABAJO_SOCIAL, Rol.ENFERMERIA)
  @ApiOperation({ summary: 'Obtener paciente por ID (registra auditoría READ_SENSITIVE)' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.patientsService.findById(id, user.userId, user.roles[0], sedeId, ip);
  }

  @Get(':id/clinical-summary')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.PSICOLOGO, Rol.ENFERMERIA, Rol.TRABAJO_SOCIAL)
  @ApiOperation({ summary: 'Resumen clínico: alergias, antecedentes, últimas 3 consultas, medicamentos activos' })
  async getClinicalSummary(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
  ) {
    return this.patientsService.getClinicalSummary(id, user.medicoId, sedeId);
  }

  @Get(':id/timeline')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.PSICOLOGO, Rol.TRABAJO_SOCIAL)
  @ApiOperation({ summary: 'Timeline clínico paginado (todas las consultas)' })
  async getTimeline(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.patientsService.getTimeline(id, +page, +limit);
  }

  @Get(':id/arco')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Exportar datos ARCO (derechos LFPDPPP)' })
  async getArco(@Param('id') id: string) {
    return this.patientsService.getArcoData(id);
  }

  @Post(':id/activate-portal')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.RECEPCION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar portal del paciente y enviar contraseña temporal' })
  async activatePortal(@Param('id') id: string, @Body() dto: ActivatePortalDto) {
    return this.patientsService.activatePortal(id, dto.email);
  }

  @Post(':id/consents/:tipo/sign')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar firma de consentimiento (NOM-004 / LFPDPPP)' })
  async signConsent(
    @Param('id') id: string,
    @Param('tipo') tipo: string,
    @Body() dto: SignConsentDto,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.patientsService.signConsent(id, tipo, dto.firmaBase64, user.userId, ip);
  }
}
