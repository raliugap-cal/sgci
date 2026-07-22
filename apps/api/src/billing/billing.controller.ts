import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddChargeDto } from './dto/add-charge.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';

@ApiTags('billing')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Listar facturas' })
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async findAll(
    @SedeId() s: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('estado') estado?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll({ sedeId: s, desde, hasta, estado, page: +page, limit: +limit });
  }

  @Get('cash-register/history')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async cashHistory(@SedeId() s: string, @Query('page') page = 1) {
    return this.svc.getCashRegisterHistory(s, +page);
  }

  @Get(':id')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN, Rol.MEDICO)
  async findById(@Param('id') id: string, @SedeId() s: string) {
    return this.svc.findById(id, s);
  }

  @Post()
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Crear pre-factura' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.create(dto, u.userId, s, ip);
  }

  @Post(':id/charges')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async addCharge(@Param('id') id: string, @Body() dto: AddChargeDto, @CurrentUser() u: any, @SedeId() s: string) {
    return this.svc.addCharge(id, dto, u.userId, s);
  }

  @Post(':id/stamp')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async stamp(@Param('id') id: string, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.stamp(id, u.userId, s, ip);
  }

  @Post(':id/payments')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async registerPayment(@Param('id') id: string, @Body() dto: RegisterPaymentDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.registerPayment(id, dto, u.userId, s, ip);
  }

  @Post(':id/cancel')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async cancel(@Param('id') id: string, @Body('motivo') motivo: string, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.cancelCfdi(id, motivo, u.userId, s, ip);
  }

  @Post('cash-register/close')
  @Roles(Rol.CAJA, Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async closeCashRegister(@CurrentUser() u: any, @SedeId() s: string, @Body('turno') turno: string) {
    return this.svc.closeCashRegister(s, u.userId, turno);
  }

  @Get('export/accounting')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async exportAccounting(
    @SedeId() s: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('formato') formato: 'xlsx' | 'csv_qbo' | 'zip' = 'xlsx',
  ) {
    return this.svc.exportAccounting(s, new Date(desde), new Date(hasta), formato);
  }
}
