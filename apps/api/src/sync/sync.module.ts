// ═══════════════════════════════════════════════════════════
// SYNC MODULE — Sincronización offline-online
// POST /api/v1/sync/staff        — dispositivos internos
// POST /api/v1/sync/patient      — portal del paciente
// GET  /api/v1/sync/prefetch/:pacienteId
// ═══════════════════════════════════════════════════════════
import {
  Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { PrismaModule } from '../database/prisma.module';
import { AuditService } from '../common/services/audit.service';
import { JwtAuthGuard, RolesGuard, CurrentUser, ClientIp, SedeId } from '../auth/strategies/jwt.strategy';
import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';

class StaffSyncDto {
  @IsString() lastSyncAt: string;
  @IsString() deviceId: string;
  @IsArray() records: any[];
}

class PatientSyncDto {
  @IsUUID() pacienteId: string;
  @IsString() lastSyncAt: string;
  @IsString() deviceId: string;
  @IsOptional() @IsArray() diaryEntries?: any[];
  @IsOptional() @IsArray() messages?: any[];
}

@ApiTags('sync')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private svc: SyncService) {}

  @Post('staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync delta de dispositivos internos (tablets, laptops de sede)' })
  async syncStaff(
    @Body() dto: StaffSyncDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.syncStaff(dto, user.userId, sedeId, ip);
  }

  @Post('patient')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync delta del portal del paciente (diario, mensajes)' })
  async syncPatient(@Body() dto: PatientSyncDto, @ClientIp() ip: string) {
    return this.svc.syncPatient(dto, ip);
  }

  @Get('prefetch/:pacienteId')
  @ApiOperation({ summary: 'Datos para precarga del portal del paciente (offline-ready)' })
  async getPrefetch(@Param('pacienteId') pacienteId: string) {
    return this.svc.getPrefetchData(pacienteId);
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [SyncService, AuditService],
  exports: [SyncService],
})
export class SyncModule {}
