// ═══════════════════════════════════════════════════════════
// STAFF MODULE — Gestión de Personal
// POST /api/v1/staff/usuarios          Crear usuario
// GET  /api/v1/staff/usuarios          Listar personal
// GET  /api/v1/staff/usuarios/:id      Ver usuario
// PATCH /api/v1/staff/usuarios/:id     Actualizar
// POST /api/v1/staff/usuarios/:id/medico  Agregar perfil médico
// POST /api/v1/staff/usuarios/:id/toggle  Activar/desactivar
// POST /api/v1/staff/usuarios/:id/reset-password
// ═══════════════════════════════════════════════════════════
import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { PrismaModule } from '../database/prisma.module';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId, ClientIp } from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsArray, IsEmail, IsEnum, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';

// ─── DTOs ─────────────────────────────────────────────────

class CreateUsuarioDto {
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsArray() @IsEnum(Rol, { each: true }) roles: Rol[];
  @IsOptional() @IsString() curp?: string;
}

class UpdateUsuarioDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellidoPaterno?: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsArray() @IsEnum(Rol, { each: true }) roles?: Rol[];
}

class CreateMedicoPerfilDto {
  @IsString() cedulaProfesional: string;
  @IsOptional() @IsString() universidad?: string;
  @IsOptional() @IsBoolean() habilitadoControlados?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) foliosCofepris?: string[];
  @IsOptional() @IsString() colorAgenda?: string;
  @IsOptional() @IsArray() especialidadIds?: string[];
}

class ResetPasswordDto {
  @IsString() @MinLength(8) nuevaPassword: string;
}

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Crear usuario ──────────────────────────────────────
  async createUsuario(dto: CreateUsuarioDto, sedeId: string, actorId: string, ip: string) {
    const existing = await this.prisma.usuario.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const usuario = await this.prisma.usuario.create({
      data: {
        sedeId,
        nombre: dto.nombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        email: dto.email.toLowerCase(),
        passwordHash,
        roles: dto.roles,
        activo: true,
        actorId,
      },
      select: {
        id: true, nombre: true, apellidoPaterno: true, email: true,
        roles: true, activo: true, createdAt: true,
      },
    });

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'CREATE_USUARIO',
      recursoTipo: 'usuario',
      recursoId: usuario.id,
    });

    this.logger.log(`Usuario creado: ${usuario.email} (${usuario.roles.join(', ')})`);
    return usuario;
  }

  // ─── Listar personal ────────────────────────────────────
  async findAll(sedeId: string, opts: { rol?: string; activo?: boolean; q?: string; page: number; limit: number }) {
    const { rol, activo, q, page, limit } = opts;
    const skip = (page - 1) * limit;

    const where: any = { sedeId };
    if (activo !== undefined) where.activo = activo;
    if (rol) where.roles = { has: rol as Rol };
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellidoPaterno: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ apellidoPaterno: 'asc' }, { nombre: 'asc' }],
        select: {
          id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true,
          email: true, roles: true, activo: true, ultimoAcceso: true, createdAt: true,
          medico: {
            select: {
              id: true, cedulaProfesional: true, habilitadoControlados: true,
              colorAgenda: true, activo: true,
              especialidades: { include: { especialidad: true } },
            },
          },
        },
      }),
    ]);

    return this.prisma.paginate(usuarios, total, page, limit);
  }

  // ─── Ver usuario ────────────────────────────────────────
  async findById(id: string, sedeId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, sedeId },
      select: {
        id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true,
        email: true, roles: true, activo: true, ultimoAcceso: true,
        intentosFallidos: true, bloqueadoHasta: true, createdAt: true,
        medico: {
          include: {
            especialidades: { include: { especialidad: true } },
          },
        },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  // ─── Actualizar usuario ─────────────────────────────────
  async update(id: string, dto: UpdateUsuarioDto, sedeId: string, actorId: string, ip: string) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id, sedeId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { ...dto, actorId },
      select: { id: true, nombre: true, apellidoPaterno: true, email: true, roles: true, activo: true },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'UPDATE_USUARIO', recursoTipo: 'usuario', recursoId: id });
    return updated;
  }

  // ─── Agregar perfil de médico ──────────────────────────
  async createMedicoPerfil(usuarioId: string, dto: CreateMedicoPerfilDto, sedeId: string, actorId: string, ip: string) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id: usuarioId, sedeId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.prisma.medico.findUnique({ where: { usuarioId } });
    if (existing) throw new ConflictException('El usuario ya tiene perfil de médico');

    // Asegurar que el rol MEDICO esté en el usuario
    const rolesActualizados = [...new Set([...usuario.roles, Rol.MEDICO])];

    const medico = await this.prisma.$transaction(async (tx) => {
      // Actualizar rol
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { roles: rolesActualizados, actorId },
      });

      // Crear perfil médico
      const m = await tx.medico.create({
        data: {
          usuarioId,
          cedulaProfesional: dto.cedulaProfesional,
          universidad: dto.universidad,
          habilitadoControlados: dto.habilitadoControlados ?? false,
          foliosCofepris: dto.foliosCofepris ?? [],
          colorAgenda: dto.colorAgenda ?? '#3B82F6',
        },
      });

      // Agregar especialidades si se especificaron
      if (dto.especialidadIds?.length) {
        await tx.medicoEspecialidad.createMany({
          data: dto.especialidadIds.map((eid, i) => ({
            medicoId: m.id,
            especialidadId: eid,
            esPrincipal: i === 0,
          })),
        });
      }

      return tx.medico.findUnique({
        where: { id: m.id },
        include: { usuario: { select: { nombre: true, email: true } }, especialidades: { include: { especialidad: true } } },
      });
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'CREATE_MEDICO', recursoTipo: 'medico', recursoId: medico!.id });
    return medico;
  }

  // ─── Activar / desactivar usuario ──────────────────────
  async toggle(id: string, sedeId: string, actorId: string, ip: string) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id, sedeId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // No puede desactivarse a sí mismo
    if (id === actorId) throw new ForbiddenException('No puedes desactivar tu propia cuenta');

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { activo: !usuario.activo, intentosFallidos: 0, bloqueadoHasta: null, actorId },
      select: { id: true, activo: true, nombre: true, email: true },
    });

    await this.audit.log({
      actorId, sedeId, ip,
      accion: updated.activo ? 'ACTIVATE_USUARIO' : 'DEACTIVATE_USUARIO',
      recursoTipo: 'usuario', recursoId: id,
    });
    return updated;
  }

  // ─── Resetear contraseña ────────────────────────────────
  async resetPassword(id: string, dto: ResetPasswordDto, sedeId: string, actorId: string, ip: string) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id, sedeId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(dto.nuevaPassword, 12);
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null, actorId },
    });

    await this.audit.log({ actorId, sedeId, ip, accion: 'RESET_PASSWORD', recursoTipo: 'usuario', recursoId: id });
    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ─── Especialidades disponibles ─────────────────────────
  async getEspecialidades() {
    return this.prisma.especialidad.findMany({ orderBy: { nombre: 'asc' } });
  }
}

// ─── Controller ───────────────────────────────────────────

@ApiTags('staff')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private svc: StaffService) {}

  @Post('usuarios')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Crear nuevo usuario del personal' })
  async create(
    @Body() dto: CreateUsuarioDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.createUsuario(dto, sedeId, user.userId, ip);
  }

  @Get('usuarios')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Listar personal de la sede' })
  async findAll(
    @SedeId() sedeId: string,
    @Query('rol') rol?: string,
    @Query('activo') activo?: string,
    @Query('q') q?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll(sedeId, {
      rol,
      activo: activo !== undefined ? activo === 'true' : undefined,
      q,
      page: +page,
      limit: +limit,
    });
  }

  @Get('especialidades')
  @ApiOperation({ summary: 'Listar especialidades médicas' })
  async getEspecialidades() {
    return this.svc.getEspecialidades();
  }

  @Get('usuarios/:id')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  async findById(@Param('id') id: string, @SedeId() sedeId: string) {
    return this.svc.findById(id, sedeId);
  }

  @Patch('usuarios/:id')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar datos del usuario' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.update(id, dto, sedeId, user.userId, ip);
  }

  @Post('usuarios/:id/medico')
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Agregar perfil de médico a un usuario' })
  async createMedicoPerfil(
    @Param('id') id: string,
    @Body() dto: CreateMedicoPerfilDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.createMedicoPerfil(id, dto, sedeId, user.userId, ip);
  }

  @Post('usuarios/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Activar o desactivar usuario' })
  async toggle(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.toggle(id, sedeId, user.userId, ip);
  }

  @Post('usuarios/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMIN_SEDE, Rol.SUPERADMIN)
  @ApiOperation({ summary: 'Resetear contraseña del usuario' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: any,
    @SedeId() sedeId: string,
    @ClientIp() ip: string,
  ) {
    return this.svc.resetPassword(id, dto, sedeId, user.userId, ip);
  }
}

// ─── Module ───────────────────────────────────────────────

@Module({
  imports: [PrismaModule],
  controllers: [StaffController],
  providers: [StaffService, AuditService],
  exports: [StaffService],
})
export class StaffModule {}
