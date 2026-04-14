// ═══════════════════════════════════════════════════════════
// BILLING — Controller · PAC · SAT · QuickBooks · Module
// ═══════════════════════════════════════════════════════════

// ─── billing.controller.ts ────────────────────────────────
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp,
} from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  IsUUID, IsArray, ValidateNested, IsDateString, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPagoSAT } from '@prisma/client';

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

@ApiTags('billing')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private svc: BillingService) {}

  @Post('invoices')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA, Rol.RECEPCION)
  @ApiOperation({ summary: 'Crear pre-factura (borrador)' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.create(dto, u.userId, s, ip);
  }

  @Get('invoices')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Listar facturas de la sede' })
  async findAll(
    @SedeId() sedeId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('estado') estado?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ) {
    return this.svc.findAll({ sedeId, desde, hasta, estado, page: +page, limit: +limit });
  }

  @Get('invoices/:id')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA, Rol.RECEPCION)
  async findById(@Param('id') id: string, @SedeId() s: string) {
    return this.svc.findById(id, s);
  }

  @Post('invoices/:id/charges')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA, Rol.RECEPCION)
  @ApiOperation({ summary: 'Agregar cargo a una factura en borrador' })
  async addCharge(
    @Param('id') id: string,
    @Body() dto: AddChargeDto,
    @CurrentUser() u: any,
    @SedeId() s: string,
  ) {
    return this.svc.addCharge(id, dto, u.userId, s);
  }

  @Post('invoices/:id/stamp')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Timbrar CFDI 4.0 ante el SAT vía PAC' })
  async stamp(@Param('id') id: string, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.stamp(id, u.userId, s, ip);
  }

  @Post('invoices/:id/payments')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Registrar pago (efectivo, tarjeta, transferencia)' })
  async registerPayment(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() u: any,
    @SedeId() s: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.registerPayment(id, dto, u.userId, s, ip);
  }

  @Post('invoices/:id/cancel')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar CFDI ante el SAT' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelCfdiDto,
    @CurrentUser() u: any,
    @SedeId() s: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.cancelCfdi(id, dto.motivo, u.userId, s, ip);
  }

  @Get('export')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Exportación contable: xlsx / csv_qbo / zip XMLs CFDI' })
  async export(
    @SedeId() sedeId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('formato') formato: string = 'xlsx',
  ) {
    return this.svc.exportAccounting(sedeId, new Date(desde), new Date(hasta), formato as any);
  }

  @Post('cash-register/close')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar corte de caja del turno' })
  async closeCashRegister(
    @Body() dto: { turno: string },
    @CurrentUser() u: any,
    @SedeId() s: string,
  ) {
    return this.svc.closeCashRegister(s, u.userId, dto.turno);
  }

  @Get('cash-register/history')
  @Roles(Rol.SUPERADMIN, Rol.ADMIN_SEDE, Rol.CAJA)
  @ApiOperation({ summary: 'Historial de cortes de caja' })
  async getCashRegisterHistory(@SedeId() sedeId: string, @Query('page') page = 1) {
    return this.svc.getCashRegisterHistory(sedeId, +page);
  }
}

// ─── pac.service.ts ──────────────────────────────────────
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PacService {
  private readonly logger = new Logger(PacService.name);

  constructor(private config: ConfigService) {}

  async timbraComprobante(sede: any, cfdiXml: string): Promise<{
    uuid: string; xmlTimbrado: string; fechaTimbrado: Date;
  }> {
    const pacUrl = sede.pacUrl ?? this.config.get('PAC_URL', '');
    const pacUser = sede.pacUser ?? this.config.get('PAC_USER', '');
    const pacPass = sede.pacPass ?? this.config.get('PAC_PASS', '');

    if (!pacUrl) {
      // Modo sandbox/simulado — útil para desarrollo
      this.logger.warn('PAC_URL no configurado — modo sandbox (UUID simulado)');
      const uuid = `00000000-0000-0000-0000-${Date.now()}`;
      const xmlTimbrado = cfdiXml.replace(
        'Sello=""',
        `Sello="SELLO_SIMULADO" NoCertificadoSAT="00001000000507085498" UUID="${uuid}"`,
      );
      return { uuid, xmlTimbrado, fechaTimbrado: new Date() };
    }

    try {
      const { data } = await axios.post(
        `${pacUrl}/cfdi40/timbrar`,
        {
          usuario: pacUser,
          contrasena: pacPass,
          comprobante: Buffer.from(cfdiXml).toString('base64'),
        },
        { timeout: 30000 },
      );

      if (!data.uuid) throw new Error(data.mensaje ?? 'Error al timbrar: UUID no recibido');

      return {
        uuid: data.uuid,
        xmlTimbrado: Buffer.from(data.cfdiTimbrado, 'base64').toString('utf8'),
        fechaTimbrado: new Date(data.fechaTimbrado),
      };
    } catch (e) {
      this.logger.error(`PAC timbraComprobante: ${e.response?.data?.mensaje ?? e.message}`);
      throw e;
    }
  }

  async cancelarComprobante(sede: any, uuid: string, motivo: string): Promise<void> {
    const pacUrl = sede.pacUrl ?? this.config.get('PAC_URL', '');
    if (!pacUrl) {
      this.logger.warn(`[SANDBOX] Cancelación simulada de UUID ${uuid}`);
      return;
    }

    await axios.post(`${pacUrl}/cfdi40/cancelar`, {
      usuario: sede.pacUser ?? this.config.get('PAC_USER', ''),
      contrasena: sede.pacPass ?? this.config.get('PAC_PASS', ''),
      rfc: sede.rfc,
      uuid,
      motivoCancelacion: motivo,
    }, { timeout: 30000 });
  }
}

// ─── sat.service.ts ───────────────────────────────────────
@Injectable()
export class SatService {
  private readonly logger = new Logger(SatService.name);
  private readonly LCO_URL: string;

  constructor(private config: ConfigService) {
    this.LCO_URL = config.get('SAT_LCO_URL', '');
  }

  async validateRfc(rfc: string): Promise<boolean> {
    // RFC especiales siempre válidos (público general)
    if (['XAXX010101000', 'XEXX010101000'].includes(rfc.toUpperCase())) return true;

    if (!this.LCO_URL) {
      this.logger.warn(`SAT_LCO_URL no configurado — RFC ${rfc} considerado válido`);
      return true;
    }

    try {
      const { data } = await axios.get(`${this.LCO_URL}?rfc=${rfc}`, { timeout: 10000 });
      return data?.estatus === 'A'; // Activo
    } catch (e) {
      this.logger.warn(`SAT LCO no disponible para RFC ${rfc}: ${e.message} — se permite continuar`);
      return true; // No bloquear por indisponibilidad del SAT
    }
  }
}

// ─── quickbooks.service.ts ────────────────────────────────
@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);

  constructor(private config: ConfigService, private prisma: PrismaService) {}

  private get syncEnabled(): boolean {
    return this.config.get<string>('QB_SYNC_ENABLED', 'false') === 'true';
  }

  async enqueueSync(facturaId: string): Promise<void> {
    if (!this.syncEnabled) {
      this.logger.debug(`QB sync desactivado — factura ${facturaId} marcada como pendiente`);
      await this.prisma.factura.update({
        where: { id: facturaId },
        data: { qbSyncPending: true },
      }).catch(() => null);
      return;
    }
    await this.doSync(facturaId);
  }

  async doSync(facturaId: string): Promise<void> {
    const factura = await this.prisma.factura.findUniqueOrThrow({
      where: { id: facturaId },
      include: { cargos: true, pagos: true, paciente: true, sede: true },
    });

    // TODO: Implementar sync real con QB API cuando QB_SYNC_ENABLED=true
    // Flujo: 1) Crear/actualizar Invoice en QB 2) Registrar Payment si pagada
    // 3) Marcar qb_sync_pending = false, guardar qb_invoice_id/qb_payment_id
    this.logger.log(`[QB] Sync para factura ${facturaId} (implementación pendiente de credenciales QB)`);
  }

  async syncHistorical(desde: Date): Promise<{ procesadas: number; errores: number }> {
    const pendientes = await this.prisma.factura.findMany({
      where: { qbSyncPending: true, fechaTimbrado: { gte: desde } },
      orderBy: { fechaTimbrado: 'asc' },
    });

    let procesadas = 0, errores = 0;
    for (const f of pendientes) {
      try {
        await this.doSync(f.id);
        procesadas++;
        await new Promise(r => setTimeout(r, 200)); // Rate limit QB: 500 req/min
      } catch { errores++; }
    }
    return { procesadas, errores };
  }
}

// ─── billing.module.ts ────────────────────────────────────
import { Module as NestModule } from '@nestjs/common';
import { PrismaModule as PM } from '../database/prisma.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule as NM } from '../notifications/notifications.module';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';

@NestModule({
  imports: [PM, FilesModule, NM],
  controllers: [BillingController],
  providers: [BillingService, PacService, SatService, QuickBooksService, AuditService],
  exports: [BillingService],
})
export class BillingModule {}
