// ═══════════════════════════════════════════════════════════
// APPOINTMENTS SERVICE — Agenda · Telemedicina · Recordatorios
// ═══════════════════════════════════════════════════════════
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { TelemedicineService } from '../telemedicine/telemedicine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/services/audit.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { CheckInDto } from './dto/check-in.dto';
import { addMinutes, isWithinInterval, parseISO, format, addHours, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TipoCita, EstadoCita } from '@prisma/client';

const ZONA_HORARIA_MX = 'America/Mexico_City';
const DURACION_POR_TIPO: Record<TipoCita, number> = {
  PRIMERA_VEZ: 45,
  SEGUIMIENTO: 30,
  URGENCIA: 20,
  TELEMEDICINA: 30,
  PROCEDIMIENTO: 60,
  EVALUACION_ADICCIONES: 90,
  SESION_GRUPAL: 60,
  SESION_FAMILIAR: 45,
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private telemedicine: TelemedicineService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  // ─── Listar citas con filtros ─────────────────────────────
  async findAll(opts: {
    sedeId: string; medicoId?: string; pacienteId?: string;
    fecha?: string; estado?: string; page: number; limit: number;
  }) {
    const { sedeId, medicoId, pacienteId, fecha, estado, page, limit } = opts;
    const skip = (page - 1) * limit;
    const where: any = { sedeId };
    if (medicoId)   where.medicoId   = medicoId;
    if (pacienteId) where.pacienteId = pacienteId;
    if (fecha) {
      const d = new Date(fecha);
      d.setHours(0, 0, 0, 0);
      const d2 = new Date(fecha);
      d2.setHours(23, 59, 59, 999);
      where.fechaInicio = { gte: d, lte: d2 };
    }
    if (estado) where.estado = estado as EstadoCita;

    const [total, citas] = await Promise.all([
      this.prisma.cita.count({ where }),
      this.prisma.cita.findMany({
        where, skip, take: limit,
        orderBy: { fechaInicio: 'asc' },
        include: {
          paciente: {
            select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, numeroExpediente: true },
          },
          medico: {
            include: { usuario: { select: { nombre: true, apellidoPaterno: true } } },
          },
        },
      }),
    ]);
    return this.prisma.paginate(citas, total, page, limit);
  }

  // ─── Obtener cita por ID ─────────────────────────────────
  async findById(id: string, sedeId: string) {
    const cita = await this.prisma.cita.findFirst({
      where: { id, sedeId },
      include: {
        paciente: true,
        medico: { include: { usuario: true, especialidades: { include: { especialidad: true } } } },
        sede: true,
        consulta: true,
      },
    });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    return cita;
  }

  // ─── Disponibilidad de agenda ─────────────────────────────
  async getAvailability(dto: AvailabilityDto) {
    const { medicoId, sedeId, fecha, tipoCita, esTelemedicina } = dto;
    const duracionMinutos = DURACION_POR_TIPO[tipoCita] ?? 30;

    const fechaDate = parseISO(fecha);
    const diaSemana = fechaDate.getDay();

    // 1. Obtener horario de la sede para ese día
    const horario = await this.prisma.horarioSede.findFirst({
      where: { sedeId, diaSemana, activo: true },
    });
    if (!horario) return { slots: [], message: 'La sede no atiende ese día' };

    // 2. Obtener citas existentes del médico en esa fecha
    const inicioDia = new Date(fechaDate);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaDate);
    finDia.setHours(23, 59, 59, 999);

    const [citasExistentes, bloqueos] = await Promise.all([
      this.prisma.cita.findMany({
        where: {
          medicoId,
          sedeId,
          estado: { notIn: [EstadoCita.CANCELADA, EstadoCita.NO_SHOW] },
          fechaInicio: { gte: inicioDia, lte: finDia },
        },
        select: { fechaInicio: true, fechaFin: true },
      }),
      this.prisma.bloqueoAgenda.findMany({
        where: {
          medicoId,
          inicio: { lte: finDia },
          fin: { gte: inicioDia },
        },
      }),
    ]);

    // 3. Generar slots disponibles
    const [horaInicio, minInicio] = horario.horaApertura.split(':').map(Number);
    const [horaFin, minFin] = horario.horaCierre.split(':').map(Number);

    const inicioHorario = new Date(fechaDate);
    inicioHorario.setHours(horaInicio, minInicio, 0, 0);
    const finHorario = new Date(fechaDate);
    finHorario.setHours(horaFin, minFin, 0, 0);

    const slots: { inicio: string; fin: string; disponible: boolean }[] = [];
    let cursor = inicioHorario;

    while (addMinutes(cursor, duracionMinutos) <= finHorario) {
      const slotFin = addMinutes(cursor, duracionMinutos);

      // Verificar que no esté en el pasado
      const ahora = toZonedTime(new Date(), ZONA_HORARIA_MX);
      if (cursor <= ahora) {
        cursor = addMinutes(cursor, duracionMinutos);
        continue;
      }

      // Verificar solapamiento con citas existentes
      const ocupado = citasExistentes.some(c =>
        isWithinInterval(cursor, { start: c.fechaInicio, end: addMinutes(c.fechaFin, -1) }) ||
        isWithinInterval(slotFin, { start: addMinutes(c.fechaInicio, 1), end: c.fechaFin }),
      );

      // Verificar solapamiento con bloqueos
      const bloqueado = bloqueos.some(b =>
        cursor < b.fin && slotFin > b.inicio,
      );

      if (!ocupado && !bloqueado) {
        slots.push({
          inicio: cursor.toISOString(),
          fin: slotFin.toISOString(),
          disponible: true,
        });
      }

      cursor = addMinutes(cursor, duracionMinutos);
    }

    return { slots, duracionMinutos, fecha };
  }

  // ─── Crear cita ───────────────────────────────────────────
  async create(dto: CreateAppointmentDto, actorId: string, sedeId: string, ip: string) {
    const duracionMinutos = DURACION_POR_TIPO[dto.tipoCita] ?? 30;
    const fechaInicio = parseISO(dto.fechaInicio);
    const fechaFin = addMinutes(fechaInicio, duracionMinutos);

    // Verificar disponibilidad en tiempo real
    const overlap = await this.prisma.cita.findFirst({
      where: {
        medicoId: dto.medicoId,
        estado: { notIn: [EstadoCita.CANCELADA, EstadoCita.NO_SHOW] },
        OR: [
          { fechaInicio: { gte: fechaInicio, lt: fechaFin } },
          { fechaFin: { gt: fechaInicio, lte: fechaFin } },
          { AND: [{ fechaInicio: { lte: fechaInicio } }, { fechaFin: { gte: fechaFin } }] },
        ],
      },
    });

    if (overlap) throw new ConflictException('El horario seleccionado ya no está disponible');

    // Para telemedicina: crear sala Daily.co
    let dailyRoomUrl: string | undefined;
    let dailyRoomToken: string | undefined;
    let dailyRoomName: string | undefined;

    const esTelemedicina = dto.tipoCita === TipoCita.TELEMEDICINA || dto.esTelemedicina;

    if (esTelemedicina) {
      const room = await this.telemedicine.createRoom({
        citaId: 'pending', // Se actualiza después
        pacienteId: dto.pacienteId,
        medicoId: dto.medicoId,
        fechaInicio,
        duracionMinutos,
      });
      dailyRoomUrl = room.url;
      dailyRoomToken = room.medicoToken;
      dailyRoomName = room.name;
    }

    const cita = await this.prisma.cita.create({
      data: {
        pacienteId: dto.pacienteId,
        medicoId: dto.medicoId,
        sedeId,
        tipoCita: dto.tipoCita,
        estado: EstadoCita.CONFIRMADA,
        esTelemedicina,
        dailyRoomUrl,
        dailyRoomToken,
        dailyRoomName,
        fechaInicio,
        fechaFin,
        motivoConsulta: dto.motivoConsulta,
        notasRecepcion: dto.notasRecepcion,
        actorId,
      },
      include: {
        paciente: true,
        medico: { include: { usuario: true } },
        sede: true,
      },
    });

    // Enviar confirmación (email en MVP, WA cuando esté activo)
    await this.notifications.sendAppointmentConfirmation(cita);

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'CREATE',
      recursoTipo: 'cita',
      recursoId: cita.id,
      datosNuevos: { tipoCita: dto.tipoCita, fecha: dto.fechaInicio, esTelemedicina },
    });

    return cita;
  }

  // ─── Check-in en recepción ────────────────────────────────
  async checkIn(citaId: string, dto: CheckInDto, actorId: string, sedeId: string) {
    const cita = await this.prisma.cita.findFirst({
      where: { id: citaId, sedeId },
      include: {
        paciente: true,
        medico: { include: { usuario: true } },
      },
    });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    if (cita.estado === EstadoCita.CANCELADA) throw new BadRequestException('La cita está cancelada');

    const updated = await this.prisma.cita.update({
      where: { id: citaId },
      data: {
        estado: EstadoCita.EN_ESPERA,
        checkInAt: new Date(),
        notasRecepcion: dto.notasRecepcion,
        actorId,
      },
    });

    // Notificar al médico (WebSocket via NotificationsService)
    await this.notifications.notifyMedico(cita.medicoId, {
      tipo: 'PACIENTE_LISTO',
      citaId: cita.id,
      pacienteNombre: `${cita.paciente.nombre} ${cita.paciente.apellidoPaterno}`,
      tipoCita: cita.tipoCita,
    });

    return updated;
  }

  // ─── Cancelar cita ────────────────────────────────────────
  async cancel(citaId: string, motivo: string, actorId: string, sedeId: string, ip: string) {
    const cita = await this.prisma.cita.findFirst({ where: { id: citaId, sedeId } });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    if ([EstadoCita.COMPLETADA, EstadoCita.CANCELADA].includes(cita.estado)) {
      throw new BadRequestException('No se puede cancelar una cita en este estado');
    }

    const updated = await this.prisma.cita.update({
      where: { id: citaId },
      data: { estado: EstadoCita.CANCELADA, canceladaMotivo: motivo, actorId },
      include: { paciente: true, medico: { include: { usuario: true } } },
    });

    // Notificar cancelación al paciente
    await this.notifications.sendAppointmentCancellation(updated, motivo);

    // Notificar a lista de espera si hay slots disponibles
    await this.notifyWaitlist(cita.medicoId, cita.sedeId, cita.tipoCita, cita.fechaInicio);

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'CANCEL',
      recursoTipo: 'cita',
      recursoId: citaId,
      datosNuevos: { motivo },
    });

    return updated;
  }

  // ─── Token de telemedicina para el paciente ───────────────
  async getTelehealthToken(citaId: string, pacienteId: string) {
    const cita = await this.prisma.cita.findFirst({
      where: { id: citaId, pacienteId, esTelemedicina: true },
    });
    if (!cita) throw new NotFoundException('Cita de telemedicina no encontrada');
    if (!cita.dailyRoomName) throw new BadRequestException('Sala de video no configurada');

    // Generar token del paciente (distinto al del médico)
    const token = await this.telemedicine.generatePatientToken(cita.dailyRoomName, pacienteId);

    return { roomUrl: cita.dailyRoomUrl, token };
  }

  // ─── Cron: recordatorios automáticos ─────────────────────
  @Cron('0 * * * *') // Cada hora en punto
  async sendReminders() {
    const ahora = new Date();

    // Recordatorios 24h
    const en24h = { gte: addHours(ahora, 23), lte: addHours(ahora, 25) };
    const citas24h = await this.prisma.cita.findMany({
      where: {
        estado: EstadoCita.CONFIRMADA,
        recordatorio24hEnviado: false,
        fechaInicio: en24h,
      },
      include: {
        paciente: true,
        medico: { include: { usuario: true } },
        sede: true,
      },
    });

    for (const cita of citas24h) {
      try {
        await this.notifications.sendAppointmentReminder(cita, '24h');
        await this.prisma.cita.update({
          where: { id: cita.id },
          data: { recordatorio24hEnviado: true, recordatorio24hAt: new Date() },
        });
      } catch (e) {
        this.logger.error(`Error enviando recordatorio 24h para cita ${cita.id}: ${e.message}`);
      }
    }

    // Recordatorios 2h
    const en2h = { gte: addHours(ahora, 1.5), lte: addHours(ahora, 2.5) };
    const citas2h = await this.prisma.cita.findMany({
      where: {
        estado: { in: [EstadoCita.CONFIRMADA, EstadoCita.EN_ESPERA] },
        recordatorio2hEnviado: false,
        fechaInicio: en2h,
      },
      include: {
        paciente: true,
        medico: { include: { usuario: true } },
        sede: true,
      },
    });

    for (const cita of citas2h) {
      try {
        await this.notifications.sendAppointmentReminder(cita, '2h');
        await this.prisma.cita.update({
          where: { id: cita.id },
          data: { recordatorio2hEnviado: true, recordatorio2hAt: new Date() },
        });
      } catch (e) {
        this.logger.error(`Error enviando recordatorio 2h para cita ${cita.id}: ${e.message}`);
      }
    }

    this.logger.log(`Recordatorios enviados: ${citas24h.length} de 24h, ${citas2h.length} de 2h`);
  }

  // ─── Cron: marcar no-shows ────────────────────────────────
  @Cron('30 * * * *') // A los :30 de cada hora
  async markNoShows() {
    const haceUnaHora = subHours(new Date(), 1);
    await this.prisma.cita.updateMany({
      where: {
        estado: EstadoCita.CONFIRMADA,
        fechaFin: { lte: haceUnaHora },
      },
      data: { estado: EstadoCita.NO_SHOW },
    });
  }

  // ─── Notificar lista de espera ────────────────────────────
  private async notifyWaitlist(medicoId: string, sedeId: string, tipoCita: TipoCita, fecha: Date) {
    const enEspera = await this.prisma.listaEspera.findMany({
      where: {
        sedeId,
        tipoCita,
        disponible: true,
        expiresAt: { gt: new Date() },
        OR: [{ medicoId: null }, { medicoId }],
      },
      include: { paciente: true },
      take: 3,
      orderBy: { createdAt: 'asc' },
    });

    for (const item of enEspera) {
      await this.notifications.sendWaitlistAvailable(item, fecha);
    }
  }
}
