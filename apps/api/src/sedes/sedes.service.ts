// ═══════════════════════════════════════════════════════════
// SEDES SERVICE — SGCI
// CRUD sedes · Auto-admin · Asignación de médicos
// ═══════════════════════════════════════════════════════════
import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { CreateSedeDto, UpdateSedeDto, AsignarMedicoDto } from './sedes.dto';

const db = (prisma: any) => prisma as any;

@Injectable()
export class SedesService {
  private readonly logger = new Logger(SedesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const sedes = await db(this.prisma).sede.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { usuarios: true, pacientes: true } },
      },
    });

    return Promise.all(sedes.map(async (s: any) => {
      let totalMedicos = 0;
      try {
        totalMedicos = await db(this.prisma).medicoSede.count({
          where: { sedeId: s.id, activo: true },
        });
      } catch { totalMedicos = 0; }

      return {
        id: s.id, nombre: s.nombre, razonSocial: s.razonSocial,
        rfc: s.rfc, direccionFiscal: s.direccionFiscal,
        telefono: s.telefono, email: s.email, logoUrl: s.logoUrl,
        activa: s.activa, createdAt: s.createdAt,
        totalUsuarios: s._count.usuarios,
        totalPacientes: s._count.pacientes,
        totalMedicos,
      };
    }));
  }

  async findOne(id: string, requestingUser: { roles: string[]; sedeId: string }) {
    const isSuperadmin = requestingUser.roles.includes(Rol.SUPERADMIN);
    if (!isSuperadmin && requestingUser.sedeId !== id) {
      throw new ForbiddenException('Solo puede ver la información de su sede');
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        horarios: { orderBy: { diaSemana: 'asc' } },
        usuarios: {
          where: { roles: { has: Rol.ADMIN_SEDE }, activo: true },
          select: { id: true, nombre: true, apellidoPaterno: true, email: true, activo: true, ultimoAcceso: true },
        },
        _count: { select: { pacientes: true, citas: true } },
      },
    });

    if (!sede) throw new NotFoundException('Sede no encontrada');

    let medicosSedes: any[] = [];
    try {
      medicosSedes = await db(this.prisma).medicoSede.findMany({
        where: { sedeId: id, activo: true },
        include: {
          medico: {
            include: {
              usuario: { select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, email: true, activo: true } },
              especialidades: { include: { especialidad: { select: { nombre: true } } } },
            },
          },
        },
      });
    } catch { medicosSedes = []; }

    return { ...sede, medicosSedes };
  }

  async create(dto: CreateSedeDto, actorId: string, ip: string): Promise<{ sede: any; adminCredenciales: { email: string; password: string } }> {
    const existe = await this.prisma.sede.findFirst({ where: { nombre: { equals: dto.nombre, mode: 'insensitive' } } });
    if (existe) throw new ConflictException(`Ya existe una sede con el nombre "${dto.nombre}"`);

    const rfcExiste = await this.prisma.sede.findFirst({ where: { rfc: { equals: dto.rfc, mode: 'insensitive' } } });
    if (rfcExiste) throw new ConflictException(`El RFC ${dto.rfc} ya está registrado en otra sede`);

    const emailAdmin = dto.emailAdmin.toLowerCase().trim();
    const emailEnUso = await this.prisma.usuario.findUnique({ where: { email: emailAdmin } });
    if (emailEnUso) throw new ConflictException(`El email ${emailAdmin} ya está registrado en el sistema`);

    const passwordTemporal = this._generarPassword();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const sede = await tx.sede.create({
        data: {
          nombre: dto.nombre, razonSocial: dto.razonSocial,
          rfc: dto.rfc.toUpperCase(), direccionFiscal: dto.direccionFiscal,
          telefono: dto.telefono ?? null, email: dto.emailSede ?? null,
          licenciaSanitaria: dto.licenciaSanitaria ?? null,
          logoUrl: dto.logoUrl ?? null, configJson: dto.configJson ?? {},
          activa: true,
        },
      });

      await tx.usuario.create({
        data: {
          sedeId: sede.id, nombre: dto.nombreAdmin,
          apellidoPaterno: dto.apellidoPaternoAdmin,
          apellidoMaterno: dto.apellidoMaternoAdmin ?? null,
          email: emailAdmin, passwordHash, roles: [Rol.ADMIN_SEDE], activo: true,
        },
      });

      await tx.horarioSede.createMany({
        data: [1,2,3,4,5].map((dia) => ({
          sedeId: sede.id, diaSemana: dia,
          horaApertura: '08:00', horaCierre: '17:00', activo: true,
        })),
      });

      return { sede };
    });

    await this.audit.log({
      accion: 'SEDE_CREADA', recursoTipo: 'Sede',
      recursoId: result.sede.id, actorId, ip,
      datosNuevos: { nombre: dto.nombre, rfc: dto.rfc, adminEmail: emailAdmin },
    }).catch((e) => this.logger.error('Audit error', e));

    return {
      sede: { id: result.sede.id, nombre: result.sede.nombre, razonSocial: result.sede.razonSocial, rfc: result.sede.rfc, activa: result.sede.activa },
      adminCredenciales: { email: emailAdmin, password: passwordTemporal },
    };
  }

  async update(id: string, dto: UpdateSedeDto, actorId: string, ip: string) {
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

    await this.audit.log({ accion: 'SEDE_ACTUALIZADA', recursoTipo: 'Sede', recursoId: id, actorId, ip, datosNuevos: dto as any })
      .catch((e) => this.logger.error('Audit error', e));

    return updated;
  }

  async toggleActiva(id: string, actorId: string, ip: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    const updated = await this.prisma.sede.update({ where: { id }, data: { activa: !sede.activa } });

    await this.audit.log({
      accion: updated.activa ? 'SEDE_ACTIVADA' : 'SEDE_DESACTIVADA',
      recursoTipo: 'Sede', recursoId: id, actorId, ip,
      datosNuevos: { nombre: sede.nombre, activa: updated.activa },
    }).catch((e) => this.logger.error('Audit error', e));

    return { id, activa: updated.activa, nombre: updated.nombre };
  }

  async getMedicosDisponibles(sedeId: string) {
    let asignadosIds: string[] = [];
    try {
      const asignados = await db(this.prisma).medicoSede.findMany({ where: { sedeId, activo: true }, select: { medicoId: true } });
      asignadosIds = asignados.map((a: any) => a.medicoId);
    } catch { asignadosIds = []; }

    return this.prisma.medico.findMany({
      where: { activo: true, id: { notIn: asignadosIds } },
      include: {
        usuario: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true, email: true } },
        especialidades: { include: { especialidad: { select: { nombre: true } } } },
      },
    });
  }

  async asignarMedico(sedeId: string, dto: AsignarMedicoDto, actorId: string, ip: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    const medico = await this.prisma.medico.findUnique({
      where: { id: dto.medicoId },
      include: { usuario: { select: { nombre: true, apellidoPaterno: true } } },
    });
    if (!medico) throw new NotFoundException('Médico no encontrado');

    const relacion = await db(this.prisma).medicoSede.upsert({
      where: { medicoId_sedeId: { medicoId: dto.medicoId, sedeId } },
      create: { medicoId: dto.medicoId, sedeId, activo: true, esSedeBase: dto.esSedeBase ?? false },
      update: { activo: true, esSedeBase: dto.esSedeBase ?? false },
    });

    await this.audit.log({
      accion: 'MEDICO_ASIGNADO_SEDE', recursoTipo: 'MedicoSede', recursoId: sedeId, actorId, ip,
      datosNuevos: { medicoId: dto.medicoId, medicoNombre: `${medico.usuario.nombre} ${medico.usuario.apellidoPaterno}`, sedeNombre: sede.nombre },
    }).catch((e) => this.logger.error('Audit error', e));

    return relacion;
  }

  async desasignarMedico(sedeId: string, medicoId: string, actorId: string, ip: string) {
    const relacion = await db(this.prisma).medicoSede.findUnique({ where: { medicoId_sedeId: { medicoId, sedeId } } });
    if (!relacion) throw new NotFoundException('El médico no está asignado a esta sede');

    await db(this.prisma).medicoSede.update({ where: { medicoId_sedeId: { medicoId, sedeId } }, data: { activo: false } });

    await this.audit.log({ accion: 'MEDICO_DESASIGNADO_SEDE', recursoTipo: 'MedicoSede', recursoId: sedeId, actorId, ip, datosNuevos: { medicoId, sedeId } })
      .catch((e) => this.logger.error('Audit error', e));

    return { ok: true };
  }

  async getSedesDeMedico(medicoId: string) {
    try {
      return await db(this.prisma).medicoSede.findMany({
        where: { medicoId, activo: true },
        include: { sede: { select: { id: true, nombre: true, razonSocial: true, telefono: true, activa: true } } },
      });
    } catch { return []; }
  }

  private _generarPassword(): string {
    const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minus = 'abcdefghjkmnpqrstuvwxyz';
    const digitos = '23456789';
    const simbolos = '@#$!';
    const rand = (chars: string) => chars[crypto.randomInt(0, chars.length)];
    const partes = [
      rand(mayus), rand(mayus), rand(mayus),
      rand(digitos), rand(digitos), rand(digitos), rand(digitos),
      rand(minus), rand(minus), rand(minus), rand(simbolos),
    ];
    return partes.map((c) => ({ c, sort: crypto.randomInt(0, 100) }))
      .sort((a, b) => a.sort - b.sort).map((x) => x.c).join('');
  }
}
