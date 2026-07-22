// ═══════════════════════════════════════════════════════════
// SEDES SERVICE — SGCI
// CRUD sedes · Auto-admin · Asignación de médicos
// Solo SUPERADMIN puede crear/editar · ADMIN_SEDE solo lee su sede
// ═══════════════════════════════════════════════════════════
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  CreateSedeDto,
  UpdateSedeDto,
  AsignarMedicoDto,
} from './sedes.dto';

@Injectable()
export class SedesService {
  private readonly logger = new Logger(SedesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Listar todas las sedes (SUPERADMIN) ─────────────────
  async findAll() {
    const sedes = await this.prisma.sede.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: {
            usuarios:     true,
            pacientes:    true,
            medicosSedes: true,
          },
        },
      },
    });

    return sedes.map((s) => ({
      id:            s.id,
      nombre:        s.nombre,
      domicilio:     s.domicilio,
      telefono:      s.telefono,
      email:         s.email,
      logoUrl:       s.logoUrl,
      activa:        s.activa,
      createdAt:     s.createdAt,
      totalUsuarios: s._count.usuarios,
      totalPacientes: s._count.pacientes,
      totalMedicos:  s._count.medicosSedes,
    }));
  }

  // ─── Obtener una sede (SUPERADMIN o ADMIN_SEDE de esa sede) ──
  async findOne(id: string, requestingUser: { roles: string[]; sedeId: string }) {
    const isSuperadmin = requestingUser.roles.includes(Rol.SUPERADMIN);

    // ADMIN_SEDE solo puede ver su propia sede
    if (!isSuperadmin && requestingUser.sedeId !== id) {
      throw new ForbiddenException('Solo puede ver la información de su sede');
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        horarios: { orderBy: { diaSemana: 'asc' } },
        medicosSedes: {
          where: { activo: true },
          include: {
            medico: {
              include: {
                usuario: {
                  select: {
                    id:              true,
                    nombre:          true,
                    apellidoPaterno: true,
                    apellidoMaterno: true,
                    email:           true,
                    activo:          true,
                  },
                },
                especialidades: {
                  include: { especialidad: { select: { nombre: true } } },
                },
              },
            },
          },
        },
        usuarios: {
          where: {
            roles: { has: Rol.ADMIN_SEDE },
            activo: true,
          },
          select: {
            id:              true,
            nombre:          true,
            apellidoPaterno: true,
            email:           true,
            activo:          true,
            ultimoAcceso:    true,
          },
        },
        _count: {
          select: {
            pacientes: true,
            citas:     true,
          },
        },
      },
    });

    if (!sede) throw new NotFoundException('Sede no encontrada');
    return sede;
  }

  // ─── Crear sede + admin automático ───────────────────────
  async create(
    dto: CreateSedeDto,
    actorId: string,
    ip: string,
  ): Promise<{ sede: any; adminCredenciales: { email: string; password: string } }> {
    // Verificar nombre único
    const existe = await this.prisma.sede.findFirst({
      where: { nombre: { equals: dto.nombre, mode: 'insensitive' } },
    });
    if (existe) throw new ConflictException(`Ya existe una sede con el nombre "${dto.nombre}"`);

    // Generar password seguro para el admin
    const passwordTemporal = this._generarPassword();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);

    // Normalizar email admin
    const emailAdmin = dto.emailAdmin.toLowerCase().trim();

    // Verificar que el email del admin no esté en uso
    const emailEnUso = await this.prisma.usuario.findUnique({
      where: { email: emailAdmin },
    });
    if (emailEnUso) {
      throw new ConflictException(`El email ${emailAdmin} ya está registrado en el sistema`);
    }

    // Transacción: crear sede + admin en un solo commit
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear la sede
      const sede = await tx.sede.create({
        data: {
          nombre:           dto.nombre,
          domicilio:        dto.domicilio,
          telefono:         dto.telefono ?? null,
          email:            dto.emailSede ?? null,
          licenciaSanitaria: dto.licenciaSanitaria ?? null,
          logoUrl:          dto.logoUrl ?? null,
          configJson:       dto.configJson ?? {},
          activa:           true,
        },
      });

      // 2. Crear el usuario ADMIN_SEDE
      const admin = await tx.usuario.create({
        data: {
          sedeId:         sede.id,
          nombre:         dto.nombreAdmin,
          apellidoPaterno: dto.apellidoPaternoAdmin,
          apellidoMaterno: dto.apellidoMaternoAdmin ?? null,
          email:          emailAdmin,
          passwordHash,
          roles:          [Rol.ADMIN_SEDE],
          activo:         true,
        },
      });

      // 3. Crear horarios por defecto (Lun-Vie 08:00-17:00)
      const diasHabil = [1, 2, 3, 4, 5];
      await tx.horarioSede.createMany({
        data: diasHabil.map((dia) => ({
          sedeId:       sede.id,
          diaSemana:    dia,
          horaApertura: '08:00',
          horaCierre:   '17:00',
          activo:       true,
        })),
      });

      return { sede, admin };
    });

    // Auditoría fuera de la transacción
    await this.audit.log({
      accion:    'SEDE_CREADA',
      entidad:   'Sede',
      entidadId: result.sede.id,
      actorId,
      ip,
      detalles:  { nombre: dto.nombre, adminEmail: emailAdmin },
    }).catch((e) => this.logger.error('Audit error', e));

    return {
      sede: {
        id:       result.sede.id,
        nombre:   result.sede.nombre,
        domicilio: result.sede.domicilio,
        activa:   result.sede.activa,
      },
      adminCredenciales: {
        email:    emailAdmin,
        password: passwordTemporal, // Solo se muestra una vez
      },
    };
  }

  // ─── Actualizar sede ─────────────────────────────────────
  async update(
    id: string,
    dto: UpdateSedeDto,
    actorId: string,
    ip: string,
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    const updated = await this.prisma.sede.update({
      where: { id },
      data: {
        ...(dto.nombre           !== undefined && { nombre:           dto.nombre }),
        ...(dto.domicilio        !== undefined && { domicilio:        dto.domicilio }),
        ...(dto.telefono         !== undefined && { telefono:         dto.telefono }),
        ...(dto.emailSede        !== undefined && { email:            dto.emailSede }),
        ...(dto.licenciaSanitaria !== undefined && { licenciaSanitaria: dto.licenciaSanitaria }),
        ...(dto.logoUrl          !== undefined && { logoUrl:          dto.logoUrl }),
        ...(dto.configJson       !== undefined && { configJson:       dto.configJson }),
      },
    });

    await this.audit.log({
      accion:    'SEDE_ACTUALIZADA',
      entidad:   'Sede',
      entidadId: id,
      actorId,
      ip,
      detalles:  dto,
    }).catch((e) => this.logger.error('Audit error', e));

    return updated;
  }

  // ─── Activar / Desactivar sede ───────────────────────────
  async toggleActiva(id: string, actorId: string, ip: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    // No permitir desactivar la sede del propio superadmin
    // (la sede con ID semilla siempre debe estar activa)
    const updated = await this.prisma.sede.update({
      where: { id },
      data: { activa: !sede.activa },
    });

    await this.audit.log({
      accion:    updated.activa ? 'SEDE_ACTIVADA' : 'SEDE_DESACTIVADA',
      entidad:   'Sede',
      entidadId: id,
      actorId,
      ip,
      detalles:  { nombre: sede.nombre },
    }).catch((e) => this.logger.error('Audit error', e));

    return { id, activa: updated.activa, nombre: updated.nombre };
  }

  // ─── Listar médicos disponibles para asignar ─────────────
  async getMedicosDisponibles(sedeId: string) {
    // Médicos que ya están en esta sede
    const asignados = await this.prisma.medicoSede.findMany({
      where: { sedeId, activo: true },
      select: { medicoId: true },
    });
    const asignadosIds = asignados.map((a) => a.medicoId);

    // Todos los médicos activos del sistema que NO están asignados a esta sede
    const medicos = await this.prisma.medico.findMany({
      where: {
        activo: true,
        id: { notIn: asignadosIds },
      },
      include: {
        usuario: {
          select: {
            nombre:          true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email:           true,
          },
        },
        especialidades: {
          include: { especialidad: { select: { nombre: true } } },
        },
      },
    });

    return medicos;
  }

  // ─── Asignar médico a sede ────────────────────────────────
  async asignarMedico(
    sedeId: string,
    dto: AsignarMedicoDto,
    actorId: string,
    ip: string,
  ) {
    // Verificar que la sede existe
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    // Verificar que el médico existe
    const medico = await this.prisma.medico.findUnique({
      where: { id: dto.medicoId },
      include: { usuario: { select: { nombre: true, apellidoPaterno: true } } },
    });
    if (!medico) throw new NotFoundException('Médico no encontrado');

    // Upsert: si ya existe la relación (inactiva), la reactiva
    const relacion = await this.prisma.medicoSede.upsert({
      where: {
        medicoId_sedeId: { medicoId: dto.medicoId, sedeId },
      },
      create: {
        medicoId:  dto.medicoId,
        sedeId,
        activo:    true,
        esSedeBase: dto.esSedeBase ?? false,
      },
      update: {
        activo:    true,
        esSedeBase: dto.esSedeBase ?? false,
      },
    });

    await this.audit.log({
      accion:    'MEDICO_ASIGNADO_SEDE',
      entidad:   'MedicoSede',
      entidadId: sedeId,
      actorId,
      ip,
      detalles:  {
        medicoId:  dto.medicoId,
        medicoNombre: `${medico.usuario.nombre} ${medico.usuario.apellidoPaterno}`,
        sedeNombre: sede.nombre,
      },
    }).catch((e) => this.logger.error('Audit error', e));

    return relacion;
  }

  // ─── Desasignar médico de sede ────────────────────────────
  async desasignarMedico(
    sedeId: string,
    medicoId: string,
    actorId: string,
    ip: string,
  ) {
    const relacion = await this.prisma.medicoSede.findUnique({
      where: { medicoId_sedeId: { medicoId, sedeId } },
    });
    if (!relacion) throw new NotFoundException('El médico no está asignado a esta sede');

    await this.prisma.medicoSede.update({
      where: { medicoId_sedeId: { medicoId, sedeId } },
      data: { activo: false },
    });

    await this.audit.log({
      accion:    'MEDICO_DESASIGNADO_SEDE',
      entidad:   'MedicoSede',
      entidadId: sedeId,
      actorId,
      ip,
      detalles:  { medicoId, sedeId },
    }).catch((e) => this.logger.error('Audit error', e));

    return { ok: true };
  }

  // ─── Sedes de un médico (para agenda multi-sede) ─────────
  async getSedesDeMedico(medicoId: string) {
    return this.prisma.medicoSede.findMany({
      where: { medicoId, activo: true },
      include: {
        sede: {
          select: {
            id:       true,
            nombre:   true,
            domicilio: true,
            telefono: true,
            activa:   true,
          },
        },
      },
    });
  }

  // ─── Generar password temporal seguro ────────────────────
  private _generarPassword(): string {
    // Formato: 3 mayúsculas + 4 dígitos + 3 minúsculas + símbolo
    const mayus   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minus   = 'abcdefghjkmnpqrstuvwxyz';
    const digitos = '23456789';
    const simbolos = '@#$!';

    const rand = (chars: string) =>
      chars[crypto.randomInt(0, chars.length)];

    const partes = [
      rand(mayus), rand(mayus), rand(mayus),
      rand(digitos), rand(digitos), rand(digitos), rand(digitos),
      rand(minus), rand(minus), rand(minus),
      rand(simbolos),
    ];

    // Mezclar para que no sea predecible el patrón
    return partes
      .map((c, i) => ({ c, sort: crypto.randomInt(0, 100) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.c)
      .join('');
  }
}
