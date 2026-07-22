// ═══════════════════════════════════════════════════════════
// BILLING MODULE — Controller · PAC · SAT · QuickBooks
// ═══════════════════════════════════════════════════════════

// ─── Imports globales (deben ir primero) ─────────────────
import { Injectable, Logger } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  IsUUID, Min,
} from 'class-validator';
import { MetodoPagoSAT } from '@prisma/client';
import { Rol } from '@prisma/client';
import axios from 'axios';

// ─── Imports locales ─────────────────────────────────────
import { PrismaService } from '../database/prisma.service';
import { PrismaModule } from '../database/prisma.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditService } from '../common/services/audit.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PacService } from './services/pac.service';
import { SatService } from './services/sat.service';
import { QuickBooksService } from './services/quickbooks.service';
import {
  JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp,
} from '../auth/strategies/jwt.strategy';

// ─── DTOs locales ─────────────────────────────────────────
class CreateInvoiceDto {
  @IsUUID() pacienteId: string;
  @IsOptional() @IsUUID() consultaId?: string;
  @IsOptional() @IsString() rfcReceptor?: string;
  @IsOptional() @IsString() razonSocialReceptor?: string;
  @IsOptional() @IsString() regimenFiscalReceptor?: string;
  @IsOptional() @IsString() usoCfdi?: string;
}

class AddChargeDto {
  @IsOptional() @IsUUID() servicioId?: string;
  @IsString() concepto: string;
  @IsString() claveSAT: string;
  @IsOptional() @IsString() claveUnidadSAT?: string;
  @IsNumber() @Min(0) precioUnitario: number;
  @IsOptional() @IsNumber() @Min(0) cantidad?: number;
  @IsOptional() @IsNumber() @Min(0) descuento?: number;
  @IsOptional() @IsBoolean() ivaAplicable?: boolean;
  @IsOptional() @IsNumber() tasaIva?: number;
}

class RegisterPaymentDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsEnum(MetodoPagoSAT) metodoPago: MetodoPagoSAT;
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsString() conektaChargeId?: string;
  @IsOptional() @IsString() notas?: string;
}

class CancelCfdiDto {
  @IsString() motivo: string;
}

// ─── PAC Service ─────────────────────────────────────────
@Module({
  imports: [PrismaModule, FilesModule, NotificationsModule],
  controllers: [BillingController],
  providers: [BillingService, PacService, SatService, QuickBooksService, AuditService],
  exports: [BillingService],
})
export class BillingModule {}
