// ═══════════════════════════════════════════════════════════
// TESTS — appointments.service.spec.ts
// Disponibilidad · Crear cita · Check-in · Cancelar · Crons
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../database/prisma.service';
import { TelemedicineService } from '../telemedicine/telemedicine.module';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/services/audit.service';
import { addDays, addHours, format } from 'date-fns';

const makePrisma = () => ({
  cita: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  horarioSede: { findFirst: jest.fn() },
  bloqueoAgenda: { findMany: jest.fn().mockResolvedValue([]) },
  listaEspera: { findMany: jest.fn().mockResolvedValue([]) },
  auditoria: { create: jest.fn() },
  paginate: jest.fn().mockImplementation((data, total, page, limit) => ({ data, meta: { total, page, limit } })),
});

const makeTelehealth = () => ({
  createRoom: jest.fn().mockResolvedValue({ url: 'https://demo.daily.co/room-test', name: 'room-test', medicoToken: 'token-medico' }),
  generatePatientToken: jest.fn().mockResolvedValue('token-paciente'),
});

const makeNotifications = () => ({
  sendAppointmentConfirmation: jest.fn().mockResolvedValue(undefined),
  sendAppointmentReminder: jest.fn().mockResolvedValue(undefined),
  sendAppointmentCancellation: jest.fn().mockResolvedValue(undefined),
  sendWaitlistAvailable: jest.fn().mockResolvedValue(undefined),
  notifyMedico: jest.fn().mockResolvedValue(undefined),
});

const makeAudit = () => ({ log: jest.fn() });

const MANANA = addDays(new Date(), 1);
const MANANA_10AM = new Date(MANANA.setHours(10, 0, 0, 0));

const MOCK_CITA = {
  id: 'cita-001',
  pacienteId: 'pac-001',
  medicoId: 'medico-001',
  sedeId: 'sede-001',
  tipoCita: 'SEGUIMIENTO',
  estado: 'CONFIRMADA',
  esTelemedicina: false,
  fechaInicio: MANANA_10AM,
  fechaFin: addHours(MANANA_10AM, 0.5),
  recordatorio24hEnviado: false,
  recordatorio2hEnviado: false,
  paciente: { nombre: 'Ana', apellidoPaterno: 'López', emailCifrado: Buffer.from('ana@test.com') },
  medico: { usuario: { nombre: 'Carlos', apellidoPaterno: 'García' } },
  sede: { nombre: 'Sede Principal' },
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: ReturnType<typeof makePrisma>;
  let notifications: ReturnType<typeof makeNotifications>;

  beforeEach(async () => {
    prisma = makePrisma();
    notifications = makeNotifications();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemedicineService, useValue: makeTelehealth() },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: makeAudit() },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getAvailability ─────────────────────────────────────
  describe('getAvailability', () => {
    it('retorna slots disponibles dentro del horario de la sede', async () => {
      prisma.horarioSede.findFirst.mockResolvedValue({
        diaSemana: MANANA_10AM.getDay(),
        horaApertura: '08:00',
        horaCierre: '18:00',
        activo: true,
      });
      prisma.cita.findMany.mockResolvedValue([]);
      prisma.bloqueoAgenda.findMany.mockResolvedValue([]);

      const result = await service.getAvailability({
        medicoId: 'medico-001',
        sedeId: 'sede-001',
        fecha: format(MANANA_10AM, 'yyyy-MM-dd'),
        tipoCita: 'SEGUIMIENTO' as any,
        esTelemedicina: false,
      });

      expect(result.slots).toBeDefined();
      expect(Array.isArray(result.slots)).toBe(true);
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0]).toHaveProperty('inicio');
      expect(result.slots[0]).toHaveProperty('disponible', true);
    });

    it('no retorna slots en días sin horario de sede', async () => {
      prisma.horarioSede.findFirst.mockResolvedValue(null);

      const result = await service.getAvailability({
        medicoId: 'medico-001',
        sedeId: 'sede-001',
        fecha: format(MANANA_10AM, 'yyyy-MM-dd'),
        tipoCita: 'SEGUIMIENTO' as any,
        esTelemedicina: false,
      });

      expect(result.slots).toHaveLength(0);
      expect(result.message).toContain('no atiende');
    });

    it('excluye slots ocupados por citas existentes', async () => {
      prisma.horarioSede.findFirst.mockResolvedValue({
        horaApertura: '08:00', horaCierre: '18:00', activo: true,
      });
      // Cita que ocupa las 10:00-10:30
      prisma.cita.findMany.mockResolvedValue([{
        fechaInicio: MANANA_10AM,
        fechaFin: addHours(MANANA_10AM, 0.5),
      }]);

      const result = await service.getAvailability({
        medicoId: 'medico-001',
        sedeId: 'sede-001',
        fecha: format(MANANA_10AM, 'yyyy-MM-dd'),
        tipoCita: 'SEGUIMIENTO' as any,
        esTelemedicina: false,
      });

      const slot10am = result.slots.find(
        (s: any) => new Date(s.inicio).getHours() === 10 && new Date(s.inicio).getMinutes() === 0,
      );
      expect(slot10am).toBeUndefined(); // Slot ocupado no debe aparecer
    });
  });

  // ─── create ──────────────────────────────────────────────
  describe('create', () => {
    it('crea cita presencial exitosamente', async () => {
      prisma.cita.findFirst.mockResolvedValue(null); // Sin solapamiento
      prisma.cita.create.mockResolvedValue(MOCK_CITA);

      const result = await service.create(
        {
          pacienteId: 'pac-001',
          medicoId: 'medico-001',
          tipoCita: 'SEGUIMIENTO' as any,
          fechaInicio: MANANA_10AM.toISOString(),
          esTelemedicina: false,
        },
        'actor-001',
        'sede-001',
        '127.0.0.1',
      );

      expect(prisma.cita.create).toHaveBeenCalledTimes(1);
      expect(notifications.sendAppointmentConfirmation).toHaveBeenCalled();
      expect(result.id).toBe('cita-001');
    });

    it('lanza ConflictException si el horario está ocupado', async () => {
      prisma.cita.findFirst.mockResolvedValue(MOCK_CITA); // Overlap encontrado

      await expect(service.create(
        {
          pacienteId: 'pac-001',
          medicoId: 'medico-001',
          tipoCita: 'SEGUIMIENTO' as any,
          fechaInicio: MANANA_10AM.toISOString(),
        },
        'actor-001',
        'sede-001',
        '127.0.0.1',
      )).rejects.toThrow(ConflictException);

      expect(prisma.cita.create).not.toHaveBeenCalled();
    });

    it('crea sala Daily.co para citas de telemedicina', async () => {
      prisma.cita.findFirst.mockResolvedValue(null);
      prisma.cita.create.mockResolvedValue({ ...MOCK_CITA, esTelemedicina: true, dailyRoomUrl: 'https://demo.daily.co/room' });

      await service.create(
        {
          pacienteId: 'pac-001',
          medicoId: 'medico-001',
          tipoCita: 'TELEMEDICINA' as any,
          fechaInicio: MANANA_10AM.toISOString(),
          esTelemedicina: true,
        },
        'actor-001',
        'sede-001',
        '127.0.0.1',
      );

      // Verifica que se incluyeron datos de Daily.co en la creación
      const createCall = prisma.cita.create.mock.calls[0][0];
      expect(createCall.data.dailyRoomUrl).toBeDefined();
      expect(createCall.data.esTelemedicina).toBe(true);
    });
  });

  // ─── checkIn ─────────────────────────────────────────────
  describe('checkIn', () => {
    it('cambia estado a EN_ESPERA y notifica al médico', async () => {
      prisma.cita.findFirst.mockResolvedValue(MOCK_CITA);
      prisma.cita.update.mockResolvedValue({ ...MOCK_CITA, estado: 'EN_ESPERA' });

      const result = await service.checkIn('cita-001', {}, 'actor-001', 'sede-001');

      expect(result.estado).toBe('EN_ESPERA');
      expect(notifications.notifyMedico).toHaveBeenCalledWith(
        'medico-001',
        expect.objectContaining({ tipo: 'PACIENTE_LISTO' }),
      );
    });

    it('lanza BadRequestException en cita cancelada', async () => {
      prisma.cita.findFirst.mockResolvedValue({ ...MOCK_CITA, estado: 'CANCELADA' });

      await expect(service.checkIn('cita-001', {}, 'actor-001', 'sede-001'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancel ──────────────────────────────────────────────
  describe('cancel', () => {
    it('cancela cita y notifica al paciente', async () => {
      prisma.cita.findFirst.mockResolvedValue(MOCK_CITA);
      prisma.cita.update.mockResolvedValue({ ...MOCK_CITA, estado: 'CANCELADA' });

      await service.cancel('cita-001', 'Médico no disponible', 'actor-001', 'sede-001', '127.0.0.1');

      expect(notifications.sendAppointmentCancellation).toHaveBeenCalled();
    });

    it('no puede cancelar cita ya completada', async () => {
      prisma.cita.findFirst.mockResolvedValue({ ...MOCK_CITA, estado: 'COMPLETADA' });

      await expect(service.cancel('cita-001', 'Motivo', 'actor-001', 'sede-001', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll / findById ───────────────────────────────────
  describe('findAll', () => {
    it('filtra por fecha correctamente', async () => {
      prisma.cita.count.mockResolvedValue(3);
      prisma.cita.findMany.mockResolvedValue([MOCK_CITA]);

      const fecha = format(new Date(), 'yyyy-MM-dd');
      await service.findAll({ sedeId: 'sede-001', fecha, page: 1, limit: 50 });

      expect(prisma.cita.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fechaInicio: expect.any(Object) }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('retorna cita con datos completos', async () => {
      prisma.cita.findFirst.mockResolvedValue(MOCK_CITA);
      const result = await service.findById('cita-001', 'sede-001');
      expect(result.id).toBe('cita-001');
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.cita.findFirst.mockResolvedValue(null);
      await expect(service.findById('cita-404', 'sede-001')).rejects.toThrow(NotFoundException);
    });
  });
});
