// ═══════════════════════════════════════════════════════════
// APPOINTMENTS MODULE
// GET  /api/v1/appointments/availability
// POST /api/v1/appointments
// GET  /api/v1/appointments/:id
// POST /api/v1/appointments/:id/checkin
// POST /api/v1/appointments/:id/cancel
// GET  /api/v1/appointments/:id/telehealth-token
// GET  /api/v1/appointments?medicoId=&fecha=&sedeId=
// ═══════════════════════════════════════════════════════════
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { TelemedicineModule } from '../telemedicine/telemedicine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../database/prisma.module';
import {
  JwtAuthGuard, RolesGuard, Roles, CurrentUser,
  ClientIp, SedeId,
} from '../auth/strategies/jwt.strategy';
import { Rol, TipoCita } from '@prisma/client';
import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString, IsUUID,
} from 'class-validator';

// ─── DTOs ────────────────────────────────────────────────
class AvailabilityDto {
  @IsUUID() medicoId: string;
  @IsString() fecha: string; // YYYY-MM-DD
  @IsEnum(TipoCita) tipoCita: TipoCita;
  @IsOptional() @IsBoolean() esTelemedicina?: boolean;
}

class CreateAppointmentDto {
  @IsUUID() pacienteId: string;
  @IsUUID() medicoId: string;
  @IsEnum(TipoCita) tipoCita: TipoCita;
  @IsDateString() fechaInicio: string;
  @IsOptional() @IsBoolean() esTelemedicina?: boolean;
  @IsOptional() @IsString() motivoConsulta?: string;
  @IsOptional() @IsString() notasRecepcion?: string;
}

class CheckInDto {
  @IsOptional() @IsString() notasRecepcion?: string;
}

class CancelDto {
  @IsString() motivo: string;
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('appointments')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de agenda por médico y fecha' })
  async getAvailability(@Query() dto: AvailabilityDto, @SedeId() sedeId: string) {
    return this.svc.getAvailability({ ...dto, sedeId });
  }

  @Post()
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION)
  @ApiOperation({ summary: 'Agendar cita (envía confirmación al paciente)' })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.create(dto, user.userId, sedeId, ip);
  }

  @Get()
  @ApiOperation({ summary: 'Listar citas por médico / fecha / sede' })
  @ApiQuery({ name: 'medicoId', required: false })
  @ApiQuery({ name: 'pacienteId', required: false })
  @ApiQuery({ name: 'fecha', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'estado', required: false })
  async findAll(
    @SedeId() sedeId: string,
    @Query('medicoId') medicoId?: string,
    @Query('pacienteId') pacienteId?: string,
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.svc.findAll({ sedeId, medicoId, pacienteId, fecha, estado, page: +page, limit: +limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cita por ID' })
  async findById(@Param('id') id: string, @SedeId() sedeId: string) {
    return this.svc.findById(id, sedeId);
  }

  @Post(':id/checkin')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.RECEPCION, Rol.ENFERMERIA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-in del paciente en recepción' })
  async checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
  ) {
    return this.svc.checkIn(id, dto, user.userId, sedeId);
  }

  @Post(':id/cancel')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.MEDICO, Rol.RECEPCION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar cita' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.cancel(id, dto.motivo, user.userId, sedeId, ip);
  }

  @Get(':id/telehealth-token')
  @ApiOperation({ summary: 'Obtener token de videoconsulta para el paciente' })
  async getTelehealthToken(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getTelehealthToken(id, user.userId);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  imports: [PrismaModule, TelemedicineModule, NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
