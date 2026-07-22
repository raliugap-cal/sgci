// ═══════════════════════════════════════════════════════════
// ALMACÉN MODULE — Gestión de Inventario / Farmacia
// GET  /api/v1/almacen/productos         Listar inventario
// POST /api/v1/almacen/productos         Agregar producto
// PATCH /api/v1/almacen/productos/:id    Actualizar producto
// POST /api/v1/almacen/productos/:id/entrada   Entrada de stock
// POST /api/v1/almacen/productos/:id/salida    Salida de stock
// POST /api/v1/almacen/productos/:id/ajuste    Ajuste de stock
// POST /api/v1/almacen/productos/:id/lote      Agregar lote
// GET  /api/v1/almacen/productos/:id/movimientos
// GET  /api/v1/almacen/alertas           Productos bajo mínimo
// GET  /api/v1/almacen/caducidades       Lotes por caducar
// GET  /api/v1/almacen/reportes          Reporte de movimientos
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { PrismaModule } from '../database/prisma.module';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { addDays } from 'date-fns';

// ─── DTOs ─────────────────────────────────────────────────

class CreateProductoDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsString() unidad: string;         // piezas, ml, mg, cajas, etc.
  @IsOptional() @IsString() categoria?: string;  // medicamento, insumo, equipo
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsString() principioActivo?: string; // Para medicamentos
  @IsOptional() @IsString() presentacion?: string;    // 500mg/tab, 10ml/amp
  @IsNumber() @Min(0) @Type(() => Number) stockMinimo: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) precio?: number;
  @IsOptional() @IsBoolean() requiereReceta?: boolean;
  @IsOptional() @IsBoolean() esControlado?: boolean;
}

class UpdateProductoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsNumber() @Min(0) stockMinimo?: number;
  @IsOptional() @IsNumber() @Min(0) precio?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class MovimientoDto {
  @IsNumber() @Min(0.001) @Type(() => Number) cantidad: number;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsString() referencia?: string; // ID de consulta, paciente, proveedor
  @IsOptional() @IsString() loteId?: string;
}

class AjusteDto {
  @IsNumber() @Min(0) @Type(() => Number) stockNuevo: number;
  @IsString() motivo: string;
}

class AddLoteDto {
  @IsString() numeroLote: string;
  @IsNumber() @Min(0.001) @Type(() => Number) cantidad: number;
  @IsOptional() @IsDateString() fechaCaducidad?: string;
  @IsOptional() @IsString() proveedor?: string;
  @IsOptional() @IsNumber() @Min(0) precio?: number;
}

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class AlmacenService {
  private readonly logger = new Logger(AlmacenService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Listar inventario ──────────────────────────────────
  async findAll(sedeId: string, opts: {
    q?: string; categoria?: string; bajoMinimo?: boolean;
    activo?: boolean; page: number; limit: number;
  }) {
    const { q, categoria, bajoMinimo, activo, page, limit } = opts;
    const skip = (page - 1) * limit;
    const where: any = { sedeId };
    if (activo !== undefined) where.activo = activo;
    if (categoria) where.descripcion = { contains: categoria, mode: 'insensitive' };
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, productos] = await Promise.all([
      this.prisma.inventario.count({ where }),
      this.prisma.inventario.findMany({
        where, skip, take: limit,
        orderBy: { nombre: 'asc' },
        include: {
          lotes: {
            where: { fechaCaducidad: { gte: new Date() } },
            orderBy: { fechaCaducidad: 'asc' },
            take: 3,
          },
          _count: { select: { movimientos: true } },
        },
      }),
    ]);

    // Filtrar bajo mínimo si se solicitó
    let data = productos;
    if (bajoMinimo) {
      data = productos.filter(p => Number(p.stock) <= Number(p.stockMinimo));
    }

    // Agregar estado de stock
    const enriched = data.map(p => ({
      ...p,
      estadoStock: Number(p.stock) <= 0 ? 'AGOTADO'
        : Number(p.stock) <= Number(p.stockMinimo) ? 'BAJO_MINIMO'
        : 'DISPONIBLE',
    }));

    return this.prisma.paginate(enriched, total, page, limit);
  }

  // ─── Obtener producto ───────────────────────────────────
  async findById(id: string, sedeId: string) {
    const producto = await this.prisma.inventario.findFirst({
      where: { id, sedeId },
      include: {
        lotes: { orderBy: { fechaCaducidad: 'asc' } },
        movimientos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  // ─── Crear producto ─────────────────────────────────────
  async create(dto: CreateProductoDto, sedeId: string, actorId: string, ip: string) {
    const configJson: any = {};
    if (dto.categoria) configJson.categoria = dto.categoria;
    if (dto.codigoBarras) configJson.codigoBarras = dto.codigoBarras;
    if (dto.principioActivo) configJson.principioActivo = dto.principioActivo;
    if (dto.presentacion) configJson.presentacion = dto.presentacion;
    if (dto.requiereReceta !== undefined) configJson.requiereReceta = dto.requiereReceta;
    if (dto.esControlado !== undefined) configJson.esControlado = dto.esControlado;

    const producto = await this.prisma.inventario.create({
      data: {
        sedeId,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        unidad: dto.unidad,
        stock: 0,
        stockMinimo: dto.stockMinimo,
        precio: dto.precio,
        activo: true,
      },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE_PRODUCTO', recursoTipo: 'inventario', recursoId: producto.id });
    return producto;
  }

  // ─── Actualizar producto ────────────────────────────────
  async update(id: string, dto: UpdateProductoDto, sedeId: string, actorId: string, ip: string) {
    const producto = await this.prisma.inventario.findFirst({ where: { id, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const updated = await this.prisma.inventario.update({ where: { id }, data: dto });
    await this.audit.log({ actorId, sedeId, ip, accion: 'UPDATE_PRODUCTO', recursoTipo: 'inventario', recursoId: id });
    return updated;
  }

  // ─── Entrada de stock ───────────────────────────────────
  async entrada(id: string, dto: MovimientoDto, sedeId: string, actorId: string, ip: string) {
    const producto = await this.prisma.inventario.findFirst({ where: { id, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const stockAntes = Number(producto.stock);
    const stockDespues = stockAntes + dto.cantidad;

    await this.prisma.$transaction([
      this.prisma.inventario.update({
        where: { id },
        data: { stock: stockDespues },
      }),
      this.prisma.movimientoInventario.create({
        data: {
          inventarioId: id,
          tipo: 'entrada',
          cantidad: dto.cantidad,
          stockAntes,
          stockDespues,
          motivo: dto.motivo ?? 'Entrada de mercancía',
          referencia: dto.referencia,
          actorId,
        },
      }),
    ]);

    await this.audit.log({ actorId, sedeId, ip, accion: 'ENTRADA_STOCK', recursoTipo: 'inventario', recursoId: id });
    this.logger.log(`Entrada: ${producto.nombre} +${dto.cantidad} ${producto.unidad} → ${stockDespues}`);
    return { stockAntes, stockDespues, cantidad: dto.cantidad };
  }

  // ─── Salida de stock ────────────────────────────────────
  async salida(id: string, dto: MovimientoDto, sedeId: string, actorId: string, ip: string) {
    const producto = await this.prisma.inventario.findFirst({ where: { id, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const stockAntes = Number(producto.stock);
    if (stockAntes < dto.cantidad) {
      throw new BadRequestException(`Stock insuficiente. Disponible: ${stockAntes} ${producto.unidad}`);
    }

    const stockDespues = stockAntes - dto.cantidad;

    await this.prisma.$transaction([
      this.prisma.inventario.update({ where: { id }, data: { stock: stockDespues } }),
      this.prisma.movimientoInventario.create({
        data: {
          inventarioId: id, tipo: 'salida', cantidad: dto.cantidad,
          stockAntes, stockDespues,
          motivo: dto.motivo ?? 'Salida de mercancía',
          referencia: dto.referencia, actorId,
        },
      }),
    ]);

    await this.audit.log({ actorId, sedeId, ip, accion: 'SALIDA_STOCK', recursoTipo: 'inventario', recursoId: id });
    return { stockAntes, stockDespues, cantidad: dto.cantidad };
  }

  // ─── Ajuste de inventario ───────────────────────────────
  async ajuste(id: string, dto: AjusteDto, sedeId: string, actorId: string, ip: string) {
    const producto = await this.prisma.inventario.findFirst({ where: { id, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const stockAntes = Number(producto.stock);
    const diferencia = dto.stockNuevo - stockAntes;

    await this.prisma.$transaction([
      this.prisma.inventario.update({ where: { id }, data: { stock: dto.stockNuevo } }),
      this.prisma.movimientoInventario.create({
        data: {
          inventarioId: id, tipo: 'ajuste',
          cantidad: Math.abs(diferencia),
          stockAntes, stockDespues: dto.stockNuevo,
          motivo: dto.motivo, actorId,
        },
      }),
    ]);

    await this.audit.log({ actorId, sedeId, ip, accion: 'AJUSTE_STOCK', recursoTipo: 'inventario', recursoId: id });
    return { stockAntes, stockDespues: dto.stockNuevo, diferencia };
  }

  // ─── Agregar lote ───────────────────────────────────────
  async addLote(inventarioId: string, dto: AddLoteDto, sedeId: string, actorId: string, ip: string) {
    const producto = await this.prisma.inventario.findFirst({ where: { id: inventarioId, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const lote = await this.prisma.loteInventario.create({
      data: {
        inventarioId,
        numeroLote: dto.numeroLote,
        cantidad: dto.cantidad,
        fechaCaducidad: dto.fechaCaducidad ? new Date(dto.fechaCaducidad) : null,
        proveedor: dto.proveedor,
      },
    });

    // Actualizar stock
    await this.entrada(inventarioId, { cantidad: dto.cantidad, motivo: `Lote ${dto.numeroLote}`, referencia: lote.id }, sedeId, actorId, ip);

    return lote;
  }

  // ─── Movimientos de un producto ─────────────────────────
  async getMovimientos(id: string, sedeId: string, page: number, limit: number) {
    const producto = await this.prisma.inventario.findFirst({ where: { id, sedeId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const skip = (page - 1) * limit;
    const [total, movimientos] = await Promise.all([
      this.prisma.movimientoInventario.count({ where: { inventarioId: id } }),
      this.prisma.movimientoInventario.findMany({
        where: { inventarioId: id },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
    ]);
    return this.prisma.paginate(movimientos, total, page, limit);
  }

  // ─── Alertas: productos bajo mínimo ─────────────────────
  async getAlertas(sedeId: string) {
    const todos = await this.prisma.inventario.findMany({
      where: { sedeId, activo: true },
    });

    const bajoMinimo = todos.filter(p => Number(p.stock) <= Number(p.stockMinimo));
    const agotados   = todos.filter(p => Number(p.stock) <= 0);

    return {
      bajoMinimo: bajoMinimo.map(p => ({
        id: p.id, nombre: p.nombre, unidad: p.unidad,
        stock: p.stock, stockMinimo: p.stockMinimo,
        estado: Number(p.stock) <= 0 ? 'AGOTADO' : 'BAJO_MINIMO',
      })),
      totalBajoMinimo: bajoMinimo.length,
      totalAgotados: agotados.length,
    };
  }

  // ─── Caducidades próximas (30 días) ─────────────────────
  async getCaducidades(sedeId: string, dias = 30) {
    const limite = addDays(new Date(), dias);
    const lotes = await this.prisma.loteInventario.findMany({
      where: {
        inventario: { sedeId, activo: true },
        fechaCaducidad: { lte: limite, gte: new Date() },
        cantidad: { gt: 0 },
      },
      include: { inventario: { select: { id: true, nombre: true, unidad: true } } },
      orderBy: { fechaCaducidad: 'asc' },
    });
    return lotes;
  }

  // ─── Reporte de movimientos ─────────────────────────────
  async getReporte(sedeId: string, desde: Date, hasta: Date) {
    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: {
        inventario: { sedeId },
        createdAt: { gte: desde, lte: hasta },
      },
      include: { inventario: { select: { nombre: true, unidad: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const resumen = {
      totalEntradas: movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.cantidad), 0),
      totalSalidas:  movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + Number(m.cantidad), 0),
      totalAjustes:  movimientos.filter(m => m.tipo === 'ajuste').length,
      totalMovimientos: movimientos.length,
    };

    return { resumen, movimientos };
  }
}

// ─── Controller ───────────────────────────────────────────

@ApiTags('almacen')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('almacen')
export class AlmacenController {
  constructor(private svc: AlmacenService) {}

  @Get('productos')
  @ApiOperation({ summary: 'Listar inventario / farmacia' })
  async findAll(
    @SedeId() s: string,
    @Query('q') q?: string,
    @Query('categoria') categoria?: string,
    @Query('bajoMinimo') bajoMinimo?: string,
    @Query('activo') activo?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll(s, {
      q, categoria,
      bajoMinimo: bajoMinimo === 'true',
      activo: activo !== undefined ? activo === 'true' : undefined,
      page: +page, limit: +limit,
    });
  }

  @Get('alertas')
  @ApiOperation({ summary: 'Productos bajo stock mínimo' })
  async getAlertas(@SedeId() s: string) {
    return this.svc.getAlertas(s);
  }

  @Get('caducidades')
  @ApiOperation({ summary: 'Lotes próximos a caducar' })
  async getCaducidades(@SedeId() s: string, @Query('dias') dias = 30) {
    return this.svc.getCaducidades(s, +dias);
  }

  @Get('reportes')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Reporte de movimientos' })
  async getReporte(
    @SedeId() s: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.svc.getReporte(s, new Date(desde), new Date(hasta));
  }

  @Get('productos/:id')
  async findById(@Param('id') id: string, @SedeId() s: string) {
    return this.svc.findById(id, s);
  }

  @Get('productos/:id/movimientos')
  async getMovimientos(
    @Param('id') id: string,
    @SedeId() s: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.getMovimientos(id, s, +page, +limit);
  }

  @Post('productos')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Agregar producto al inventario' })
  async create(@Body() dto: CreateProductoDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.create(dto, s, u.userId, ip);
  }

  @Patch('productos/:id')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateProductoDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.update(id, dto, s, u.userId, ip);
  }

  @Post('productos/:id/entrada')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN, Rol.ENFERMERIA)
  @ApiOperation({ summary: 'Registrar entrada de stock' })
  async entrada(@Param('id') id: string, @Body() dto: MovimientoDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.entrada(id, dto, s, u.userId, ip);
  }

  @Post('productos/:id/salida')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN, Rol.ENFERMERIA, Rol.MEDICO)
  @ApiOperation({ summary: 'Registrar salida de stock' })
  async salida(@Param('id') id: string, @Body() dto: MovimientoDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.salida(id, dto, s, u.userId, ip);
  }

  @Post('productos/:id/ajuste')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Ajuste físico de inventario' })
  async ajuste(@Param('id') id: string, @Body() dto: AjusteDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.ajuste(id, dto, s, u.userId, ip);
  }

  @Post('productos/:id/lotes')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN, Rol.ENFERMERIA)
  @ApiOperation({ summary: 'Agregar lote con fecha de caducidad' })
  async addLote(@Param('id') id: string, @Body() dto: AddLoteDto, @CurrentUser() u: any, @SedeId() s: string, @ClientIp() ip: string) {
    return this.svc.addLote(id, dto, s, u.userId, ip);
  }
}

// ─── Module ───────────────────────────────────────────────

@Module({
  imports: [PrismaModule],
  controllers: [AlmacenController],
  providers: [AlmacenService, AuditService],
  exports: [AlmacenService],
})
export class AlmacenModule {}
