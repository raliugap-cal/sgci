// ═══════════════════════════════════════════════════════════
// SEDES SERVICE — SGCI
// CRUD sedes · Auto-admin · Asignación de médicos
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
      id:             s.id,
      nombre:         s.nombre,
      razonSocial:    s.razonSocial,
      rfc:            s.rfc,
      direccionFiscal: s.direccionFiscal,
      telefono:       s.telefono,
      email:          s.email,
      logoUrl:        s.logoUrl,
      activa:         s.activa,
      createdAt:      s.createdAt,
      totalUsuarios:  s._count.usuarios,
      totalPacientes: s._count.pacientes,
      totalMedicos:   s._count.medicosSedes,
    }));
  }

  // ─── Obtener una sede ─────────────────────────────────────
  async findOne(id: string, requestingUser: { roles: string[]; sedeId: string }) {
    const isSuperadmin = requestingUser.roles.includes(Rol.SUPERADMIN);

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
    if (existe) {
      throw new ConflictException(`Ya existe una sede con el nombre "${dto.nombre}"`);
    }

    // Verificar RFC único
    const rfcExiste = await this.prisma.sede.findFirst({
      where: { rfc: { equals: dto.rfc, mode: 'insensitive' } },
    });
    if (rfcExiste) {
      throw new ConflictException(`El RFC ${dto.rfc} ya está registrado en otra sede`);
    }

    // Verificar email del admin no esté en uso
    const emailAdmin = dto.emailAdmin.toLowerCase().trim();
    const emailEnUso = await this.prisma.usuario.findUnique({
      where: { email: emailAdmin },
    });
    if (emailEnUso) {
      throw new ConflictException(`El email ${emailAdmin} ya está registrado en el sistema`);
    }

    // Generar password seguro para el admin
    const passwordTemporal = this._generarPassword();
    const passwordHash     = await bcrypt.hash(passwordTemporal, 12);

    // Transacción: crear sede + admin en un solo commit
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear la sede
      const sede = await tx.sede.create({
        data: {
          nombre:           dto.nombre,
          razonSocial:      dto.razonSocial,
          rfc:              dto.rfc.toUpperCase(),
          direccionFiscal:  dto.direccionFiscal,
          telefono:         dto.telefono    ?? null,
          email:            dto.emailSede   ?? null,
          licenciaSanitaria: dto.licenciaSanitaria ?? null,
          logoUrl:          dto.logoUrl     ?? null,
          configJson:       dto.configJson  ?? {},
          activa:           true,
        },
      });

      // 2. Crear el usuario ADMIN_SEDE
      const admin = await tx.usuario.create({
        data: {
          sedeId:          sede.id,
          nombre:          dto.nombreAdmin,
          apellidoPaterno: dto.apellidoPaternoAdmin,
          apellidoMaterno: dto.apellidoMaternoAdmin ?? null,
          email:           emailAdmin,
          passwordHash,
          roles:           [Rol.ADMIN_SEDE],
          activo:          true,
        },
      });

      // 3. Horarios por defecto Lun-Vie 08:00-17:00
      await tx.horarioSede.createMany({
        data: [1, 2, 3, 4, 5].map((dia) => ({
          sedeId:       sede.id,
          diaSemana:    dia,
          horaApertura: '08:00',
          horaCierre:   '17:00',
          activo:       true,
        })),
      });

      return { sede, admin };
    });

    // Auditoría
    await this.audit.log({
      accion:      'SEDE_CREADA',
      recursoTipo: 'Sede',
      recursoId:   result.sede.id,
      actorId,
      ip,
      datosNuevos: { nombre: dto.nombre, rfc: dto.rfc, adminEmail: emailAdmin },
    }).catch((e) => this.logger.error('Audit error', e));

    return {
      sede: {
        id:          result.sede.id,
        nombre:      result.sede.nombre,
        razonSocial: result.sede.razonSocial,
        rfc:         result.sede.rfc,
        activa:      result.sede.activa,
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
        ...(dto.nombre            !== undefined && { nombre:            dto.nombre }),
        ...(dto.razonSocial       !== undefined && { razonSocial:       dto.razonSocial }),
        ...(dto.rfc               !== undefined && { rfc:               dto.rfc.toUpperCase() }),
        ...(dto.direccionFiscal   !== undefined && { direccionFiscal:   dto.direccionFiscal }),
        ...(dto.telefono          !== undefined && { telefono:          dto.telefono }),
        ...(dto.emailSede         !== undefined && { email:             dto.emailSede }),
        ...(dto.licenciaSanitaria !== undefined && { licenciaSanitaria: dto.licenciaSanitaria }),
        ...(dto.logoUrl           !== undefined && { logoUrl:           dto.logoUrl }),
        ...(dto.configJson        !== undefined && { configJson:        dto.configJson }),
      },
    });

    await this.audit.log({
      accion:      'SEDE_ACTUALIZADA',
      recursoTipo: 'Sede',
      recursoId:   id,
      actorId,
      ip,
      datosNuevos: dto as any,
    }).catch((e) => this.logger.error('Audit error', e));

    return updated;
  }

  // ─── Activar / Desactivar sede ───────────────────────────
  async toggleActiva(id: string, actorId: string, ip: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    const updated = await this.prisma.sede.update({
      where: { id },
      data: { activa: !sede.activa },
    });

    await this.audit.log({
      accion:      updated.activa ? 'SEDE_ACTIVADA' : 'SEDE_DESACTIVADA',
      recursoTipo: 'Sede',
      recursoId:   id,
      actorId,
      ip,
      datosNuevos: { nombre: sede.nombre, activa: updated.activa },
    }).catch((e) => this.logger.error('Audit error', e));

    return { id, activa: updated.activa, nombre: updated.nombre };
  }

  // ─── Médicos disponibles para asignar a una sede ─────────
  async getMedicosDisponibles(sedeId: string) {
    const asignados = await this.prisma.medicoSede.findMany({
      where: { sedeId, activo: true },
      select: { medicoId: true },
    });
    const asignadosIds = asignados.map((a) => a.medicoId);

    return this.prisma.medico.findMany({
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
  }

  // ─── Asignar médico a sede ────────────────────────────────
  async asignarMedico(
    sedeId: string,
    dto: AsignarMedicoDto,
    actorId: string,
    ip: string,
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    const medico = await this.prisma.medico.findUnique({
      where: { id: dto.medicoId },
      include: { usuario: { select: { nombre: true, apellidoPaterno: true } } },
    });
    if (!medico) throw new NotFoundException('Médico no encontrado');

    const relacion = await this.prisma.medicoSede.upsert({
      where: { medicoId_sedeId: { medicoId: dto.medicoId, sedeId } },
      create: {
        medicoId:   dto.medicoId,
        sedeId,
        activo:     true,
        esSedeBase: dto.esSedeBase ?? false,
      },
      update: {
        activo:     true,
        esSedeBase: dto.esSedeBase ?? false,
      },
    });

    await this.audit.log({
      accion:      'MEDICO_ASIGNADO_SEDE',
      recursoTipo: 'MedicoSede',
      recursoId:   sedeId,
      actorId,
      ip,
      datosNuevos: {
        medicoId:    dto.medicoId,
        medicoNombre: `${medico.usuario.nombre} ${medico.usuario.apellidoPaterno}`,
        sedeNombre:  sede.nombre,
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
      accion:      'MEDICO_DESASIGNADO_SEDE',
      recursoTipo: 'MedicoSede',
      recursoId:   sedeId,
      actorId,
      ip,
      datosNuevos: { medicoId, sedeId },
    }).catch((e) => this.logger.error('Audit error', e));

    return { ok: true };
  }

  // ─── Sedes de un médico ───────────────────────────────────
  async getSedesDeMedico(medicoId: string) {
    return this.prisma.medicoSede.findMany({
      where: { medicoId, activo: true },
      include: {
        sede: {
          select: {
            id:          true,
            nombre:      true,
            razonSocial: true,
            telefono:    true,
            activa:      true,
          },
        },
      },
    });
  }

  // ─── Generar password temporal seguro ────────────────────
  private _generarPassword(): string {
    const mayus   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minus   = 'abcdefghjkmnpqrstuvwxyz';
    const digitos = '23456789';
    const simbolos = '@#$!';

    const rand = (chars: string) => chars[crypto.randomInt(0, chars.length)];

    const partes = [
      rand(mayus), rand(mayus), rand(mayus),
      rand(digitos), rand(digitos), rand(digitos), rand(digitos),
      rand(minus), rand(minus), rand(minus),
      rand(simbolos),
    ];

    return partes
      .map((c) => ({ c, sort: crypto.randomInt(0, 100) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.c)
      .join('');
  }
}
