// ═══════════════════════════════════════════════════════════
// PATIENTS SERVICE — NOM-004 · LFPDPPP · CURP/RENAPO
// ═══════════════════════════════════════════════════════════
import {
  Injectable, NotFoundException, ConflictException,
  Logger, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';
import { RenapoService } from '../common/services/renapo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientSearchDto } from './dto/patient-search.dto';
import { Rol } from '@prisma/client';
import { generateExpedienteNumber } from '../common/utils/generators';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private audit: AuditService,
    private renapo: RenapoService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  // ─── Crear paciente ────────────────────────────────────────
  async create(dto: CreatePatientDto, actorId: string, sedeId: string, ip: string) {
    // 1. Validar formato de CURP
    if (dto.curp && !this.isValidCurp(dto.curp)) {
      throw new BadRequestException('CURP con formato inválido');
    }

    // 2. Verificar duplicados por CURP (si se proporciona)
    if (dto.curp) {
      const curpCifrado = this.encryption.encrypt(dto.curp.toUpperCase());
      const existente = await this.prisma.paciente.findFirst({
        where: { curp: curpCifrado },
      });
      if (existente) {
        throw new ConflictException(`Ya existe un paciente con esa CURP: ${existente.numeroExpediente}`);
      }
    }

    // 3. Validar CURP con RENAPO (no bloqueante — si falla, continúa)
    if (dto.curp && this.config.get<string>('NODE_ENV') === 'production') {
      try {
        const renapoData = await this.renapo.validarCurp(dto.curp);
        if (!renapoData.valida) {
          this.logger.warn(`CURP ${dto.curp} no validada por RENAPO: ${renapoData.mensaje}`);
          // Continúa — validación de RENAPO no bloquea el registro
        }
      } catch (e) {
        this.logger.warn(`RENAPO no disponible: ${e.message} — se continúa con CURP ingresada`);
      }
    }

    // 4. Generar número de expediente
    const ultimoExpediente = await this.prisma.paciente.findFirst({
      where: { sedeId },
      orderBy: { createdAt: 'desc' },
      select: { numeroExpediente: true },
    });
    const numeroExpediente = generateExpedienteNumber(sedeId, ultimoExpediente?.numeroExpediente);

    // 5. Crear paciente con campos cifrados
    const paciente = await this.prisma.paciente.create({
      data: {
        sedeId,
        numeroExpediente,
        nombre: dto.nombre.trim(),
        apellidoPaterno: dto.apellidoPaterno.trim(),
        apellidoMaterno: dto.apellidoMaterno?.trim(),
        fechaNacimiento: new Date(dto.fechaNacimiento),
        sexo: dto.sexo,
        generoIdentidad: dto.generoIdentidad,
        curp: dto.curp ? this.encryption.encrypt(dto.curp.toUpperCase()) : null,
        rfc: dto.rfc ? this.encryption.encrypt(dto.rfc.toUpperCase()) : null,
        regimenFiscal: dto.regimenFiscal,
        usoCfdi: dto.usoCfdi,
        emailCifrado: dto.email ? this.encryption.encrypt(dto.email.toLowerCase()) : null,
        telefonoCifrado: dto.telefono ? this.encryption.encrypt(dto.telefono) : null,
        whatsappCifrado: dto.whatsapp ? this.encryption.encrypt(dto.whatsapp) : null,
        preferenciaMensajeria: dto.preferenciaMensajeria ?? 'email', // Email en MVP
        direccion: dto.direccion,
        grupoSanguineo: dto.grupoSanguineo ?? 'DESCONOCIDO',
        estadoCivil: dto.estadoCivil,
        ocupacion: dto.ocupacion,
        escolaridad: dto.escolaridad,
        actorId,
      },
    });

    // 6. Crear consentimiento de privacidad (pendiente de firma)
    await this.prisma.consentimiento.create({
      data: {
        pacienteId: paciente.id,
        tipo: 'PRIVACIDAD_LFPDPPP',
        version: '2.0',
        textoSnapshot: this.getConsentimientoTexto('PRIVACIDAD_LFPDPPP'),
        firmado: false,
      },
    });

    // 7. Auditoría
    await this.audit.log({
      actorId,
      sedeId,
      ip,
      accion: 'CREATE',
      recursoTipo: 'paciente',
      recursoId: paciente.id,
      datosNuevos: { numeroExpediente, nombre: dto.nombre },
    });

    return this.sanitizePatient(paciente);
  }

  // ─── Buscar pacientes ──────────────────────────────────────
  async search(dto: PatientSearchDto, sedeId: string) {
    const { q, curp, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    // Si busca por CURP exacta, descifrar y buscar
    if (curp) {
      const curpCifrado = this.encryption.encrypt(curp.toUpperCase());
      const paciente = await this.prisma.paciente.findFirst({
        where: { curp: curpCifrado, activo: true },
      });
      if (!paciente) return this.prisma.paginate([], 0, page, limit);
      return this.prisma.paginate([this.sanitizePatient(paciente)], 1, page, limit);
    }

    // Búsqueda por nombre (full-text en PostgreSQL)
    const where: any = {
      sedeId,
      activo: true,
    };

    if (q && q.trim()) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellidoPaterno: { contains: q, mode: 'insensitive' } },
        { apellidoMaterno: { contains: q, mode: 'insensitive' } },
        { numeroExpediente: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, pacientes] = await Promise.all([
      this.prisma.paciente.count({ where }),
      this.prisma.paciente.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ apellidoPaterno: 'asc' }, { nombre: 'asc' }],
      }),
    ]);

    return this.prisma.paginate(
      pacientes.map(p => this.sanitizePatient(p)),
      total, page, limit,
    );
  }

  // ─── Obtener paciente por ID ───────────────────────────────
  async findById(id: string, actorId: string, actorRol: Rol, sedeId: string, ip: string) {
    const paciente = await this.prisma.paciente.findFirst({
      where: { id, activo: true },
      include: {
        consentimientos: { where: { vigente: true } },
        alergias: { where: { activa: true } },
        antecedentes: { where: { activo: true } },
      },
    });

    if (!paciente) throw new NotFoundException('Paciente no encontrado');

    // Auditoría de lectura de datos sensibles
    await this.audit.log({
      actorId,
      sedeId,
      ip,
      accion: 'READ_SENSITIVE',
      recursoTipo: 'paciente',
      recursoId: id,
    });

    return this.sanitizePatient(paciente, true);
  }

  // ─── Resumen clínico para el médico ───────────────────────
  async getClinicalSummary(pacienteId: string, medicoId: string, sedeId: string) {
    const [paciente, ultimasConsultas, medicamentosActivos] = await Promise.all([
      this.prisma.paciente.findUniqueOrThrow({
        where: { id: pacienteId },
        include: {
          alergias: { where: { activa: true } },
          antecedentes: { where: { activo: true } },
        },
      }),
      this.prisma.consulta.findMany({
        where: { pacienteId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
          notas: { where: { firmada: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          diagnosticos: { include: { cie10: true } },
          signosVitales: true,
        },
      }),
      this.prisma.receta.findMany({
        where: { pacienteId, estado: 'ACTIVA' },
        include: { items: { include: { medicamento: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      paciente: this.sanitizePatient(paciente, true),
      alergias: paciente.alergias,
      antecedentes: paciente.antecedentes,
      ultimasConsultas,
      medicamentosActivos,
    };
  }

  // ─── Timeline clínico ─────────────────────────────────────
  async getTimeline(pacienteId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, consultas] = await Promise.all([
      this.prisma.consulta.count({ where: { pacienteId } }),
      this.prisma.consulta.findMany({
        where: { pacienteId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          medico: { include: { usuario: true, especialidades: { include: { especialidad: true } } } },
          sede: { select: { nombre: true } },
          notas: { where: { firmada: true } },
          diagnosticos: { include: { cie10: true } },
          signosVitales: true,
          recetas: { include: { items: true } },
          ordenes: { select: { id: true, estado: true, fechaEmision: true } },
        },
      }),
    ]);

    return this.prisma.paginate(consultas, total, page, limit);
  }

  // ─── Derechos ARCO (LFPDPPP) ─────────────────────────────
  async getArcoData(pacienteId: string) {
    const paciente = await this.prisma.paciente.findUniqueOrThrow({
      where: { id: pacienteId },
      include: {
        consentimientos: true,
        alergias: true,
        antecedentes: true,
        citas: { orderBy: { createdAt: 'desc' }, take: 10 },
        facturas: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    return {
      datosPersonales: this.sanitizePatient(paciente, true),
      consentimientos: paciente.consentimientos,
      alergias: paciente.alergias,
      antecedentes: paciente.antecedentes,
      historialCitas: paciente.citas,
      historialFacturas: paciente.facturas.map(f => ({
        id: f.id,
        fecha: f.createdAt,
        total: f.total,
        estado: f.estadoPago,
      })),
      fechaExportacion: new Date().toISOString(),
      nota: 'Datos exportados en cumplimiento con LFPDPPP Art. 22 — Derecho de Acceso',
    };
  }

  // ─── Firma de consentimiento ─────────────────────────────
  async signConsent(
    pacienteId: string,
    tipo: string,
    firmaBase64: string | undefined,
    firmadoPorId: string,
    ip: string,
  ) {
    const consentimiento = await this.prisma.consentimiento.findFirst({
      where: { pacienteId, tipo: tipo as any, vigente: true },
    });
    if (!consentimiento) {
      throw new NotFoundException(`Consentimiento de tipo ${tipo} no encontrado`);
    }
    return this.prisma.consentimiento.update({
      where: { id: consentimiento.id },
      data: {
        firmado: true,
        firmaBase64: firmaBase64 ?? null,
        ipFirma: ip,
        firmadoPorId,
        firmadoAt: new Date(),
      },
    });
  }

  // ─── Activar portal del paciente ─────────────────────────
  async activatePortal(pacienteId: string, email: string) {
    const paciente = await this.prisma.paciente.findUniqueOrThrow({ where: { id: pacienteId } });
    const tempPassword = Math.random().toString(36).substring(2, 10).toUpperCase();
    const hash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.paciente.update({
      where: { id: pacienteId },
      data: { portalActivado: true, portalPasswordHash: hash },
    });

    // Enviar contraseña temporal
    await this.notifications.sendEmail({
      to: email,
      template: 'portal_bienvenida',
      vars: { nombre: paciente.nombre, tempPassword },
    });

    return { message: 'Portal activado. Se envió contraseña temporal por email.' };
  }

  // ─── Helpers privados ────────────────────────────────────
  private sanitizePatient(paciente: any, full = false) {
    const base = {
      id: paciente.id,
      numeroExpediente: paciente.numeroExpediente,
      nombre: paciente.nombre,
      apellidoPaterno: paciente.apellidoPaterno,
      apellidoMaterno: paciente.apellidoMaterno,
      nombreCompleto: `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno ?? ''}`.trim(),
      fechaNacimiento: paciente.fechaNacimiento,
      edad: this.calcularEdad(paciente.fechaNacimiento),
      sexo: paciente.sexo,
      grupoSanguineo: paciente.grupoSanguineo,
      tieneExpedienteAdicciones: paciente.tieneExpedienteAdicciones,
      portalActivado: paciente.portalActivado,
      activo: paciente.activo,
      createdAt: paciente.createdAt,
    };

    if (!full) return base;

    return {
      ...base,
      // Descifrar campos sensibles solo para consulta completa
      curp: paciente.curp ? this.encryption.decrypt(paciente.curp) : null,
      rfc: paciente.rfc ? this.encryption.decrypt(paciente.rfc) : null,
      email: paciente.emailCifrado ? this.encryption.decrypt(paciente.emailCifrado) : null,
      telefono: paciente.telefonoCifrado ? this.encryption.decrypt(paciente.telefonoCifrado) : null,
      whatsapp: paciente.whatsappCifrado ? this.encryption.decrypt(paciente.whatsappCifrado) : null,
      regimenFiscal: paciente.regimenFiscal,
      usoCfdi: paciente.usoCfdi,
      direccion: paciente.direccion,
      estadoCivil: paciente.estadoCivil,
      ocupacion: paciente.ocupacion,
      escolaridad: paciente.escolaridad,
      preferenciaMensajeria: paciente.preferenciaMensajeria,
      consentimientos: paciente.consentimientos ?? [],
      alergias: paciente.alergias ?? [],
      antecedentes: paciente.antecedentes ?? [],
    };
  }

  private calcularEdad(fechaNacimiento: Date): number {
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;
    return edad;
  }

  private isValidCurp(curp: string): boolean {
    const regex = /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM]{1}(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}[0-9]{1}$/;
    return regex.test(curp.toUpperCase());
  }

  private getConsentimientoTexto(tipo: string): string {
    const textos: Record<string, string> = {
      PRIVACIDAD_LFPDPPP: 'De conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), consiento el tratamiento de mis datos personales y de salud para fines de atención médica, facturación y comunicaciones relacionadas con mi atención...',
      GENERAL_TRATAMIENTO: 'Acepto libre y voluntariamente el tratamiento médico recomendado, habiendo sido informado sobre los riesgos, beneficios y alternativas disponibles...',
      ADICCIONES_NOM028: 'De conformidad con la NOM-028-SSA2-2009, consiento iniciar el tratamiento para el uso problemático de sustancias psicoactivas, entendiendo la naturaleza del tratamiento y mi derecho a la confidencialidad...',
    };
    return textos[tipo] ?? '';
  }
}
