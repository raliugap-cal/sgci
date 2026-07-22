// ═══════════════════════════════════════════════════════════
// SEDES CONTROLLER — SGCI
// ═══════════════════════════════════════════════════════════
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SedesService } from './sedes.service';
import { CreateSedeDto, UpdateSedeDto, AsignarMedicoDto } from './sedes.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  ClientIp,
} from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';

@ApiTags('sedes')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sedes')
export class SedesController {
  constructor(private readonly svc: SedesService) {}

  // ─── GET /sedes — Lista todas las sedes (solo SUPERADMIN) ─
  @Get()
  @Roles(Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Listar todas las sedes del grupo (SUPERADMIN)' })
  findAll() {
    return this.svc.findAll();
  }

  // ─── GET /sedes/:id ───────────────────────────────────────
  @Get(':id')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Detalle de sede. ADMIN_SEDE solo puede ver la suya.' })
  @ApiParam({ name: 'id', description: 'UUID de la sede' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, user);
  }

  // ─── POST /sedes — Crear sede + admin automático ──────────
  @Post()
  @Roles(Rol.SUPERADMIN)
  @ApiOperation({
    summary: 'Crear nueva sede (SUPERADMIN). Genera usuario ADMIN_SEDE automáticamente.',
    description: 'El password del admin se devuelve UNA SOLA VEZ en la respuesta. Guárdalo.',
  })
  create(
    @Body() dto: CreateSedeDto,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.svc.create(dto, user.userId, ip);
  }

  // ─── PATCH /sedes/:id ─────────────────────────────────────
  @Patch(':id')
  @Roles(Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar datos de sede (SUPERADMIN)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSedeDto,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.svc.update(id, dto, user.userId, ip);
  }

  // ─── PATCH /sedes/:id/toggle-activa ──────────────────────
  @Patch(':id/toggle-activa')
  @Roles(Rol.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar sede (SUPERADMIN)' })
  toggleActiva(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.svc.toggleActiva(id, user.userId, ip);
  }

  // ─── GET /sedes/:id/medicos-disponibles ──────────────────
  @Get(':id/medicos-disponibles')
  @Roles(Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Médicos activos del sistema aún no asignados a esta sede' })
  getMedicosDisponibles(@Param('id') id: string) {
    return this.svc.getMedicosDisponibles(id);
  }

  // ─── POST /sedes/:id/medicos ──────────────────────────────
  @Post(':id/medicos')
  @Roles(Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Asignar médico a sede' })
  asignarMedico(
    @Param('id') sedeId: string,
    @Body() dto: AsignarMedicoDto,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.svc.asignarMedico(sedeId, dto, user.userId, ip);
  }

  // ─── DELETE /sedes/:id/medicos/:medicoId ─────────────────
  @Delete(':id/medicos/:medicoId')
  @Roles(Rol.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover médico de sede (soft delete)' })
  desasignarMedico(
    @Param('id') sedeId: string,
    @Param('medicoId') medicoId: string,
    @CurrentUser() user: any,
    @ClientIp() ip: string,
  ) {
    return this.svc.desasignarMedico(sedeId, medicoId, user.userId, ip);
  }

  // ─── GET /sedes/medico/:medicoId ──────────────────────────
  @Get('medico/:medicoId')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Sedes asignadas a un médico (para agenda multi-sede)' })
  getSedesDeMedico(@Param('medicoId') medicoId: string) {
    return this.svc.getSedesDeMedico(medicoId);
  }
}
