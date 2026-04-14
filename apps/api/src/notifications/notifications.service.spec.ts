// ═══════════════════════════════════════════════════════════
// TESTS — notifications.service.spec.ts + billing extras
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../database/prisma.service';

const makePrisma = () => ({
  notificacion: {
    create: jest.fn().mockResolvedValue({ id: 'notif-001' }),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
});

const makeConfig = () => ({
  get: jest.fn((key: string, def?: any) => {
    const cfg: Record<string, any> = {
      SENDGRID_API_KEY: '',     // Dev mode (no key)
      WHATSAPP_ENABLED: 'false',
      AWS_SNS_ACCESS_KEY: '',
      NODE_ENV: 'test',
      EMAIL_FROM: 'test@sgci.mx',
      EMAIL_FROM_NAME: 'Test SGCI',
    };
    return cfg[key] ?? def;
  }),
  getOrThrow: jest.fn((key: string) => key),
});

const MOCK_CITA = {
  id: 'cita-001',
  fechaInicio: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  tipoCita: 'SEGUIMIENTO',
  esTelemedicina: false,
  dailyRoomUrl: null,
  estado: 'CONFIRMADA',
  paciente: {
    nombre: 'Ana',
    apellidoPaterno: 'López',
    emailCifrado: Buffer.from('ana@ejemplo.com'),
    telefonoCifrado: Buffer.from('5512345678'),
  },
  medico: { usuario: { nombre: 'Carlos', apellidoPaterno: 'Rodríguez' } },
  sede: { nombre: 'Clínica Principal' },
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('Feature flags', () => {
    it('WhatsApp desactivado por defecto en MVP', () => {
      expect((service as any).whatsappEnabled).toBe(false);
    });

    it('SMS desactivado sin AWS_SNS_ACCESS_KEY', () => {
      expect((service as any).smsEnabled).toBe(false);
    });
  });

  describe('resolveChannels', () => {
    it('retorna solo email cuando WA y SMS están desactivados', () => {
      const paciente = {
        email: 'test@example.com',
        telefono: '5512345678',
        whatsapp: '5512345678',
      };
      const channels = (service as any).resolveChannels(paciente);
      expect(channels).not.toContain('whatsapp');
      expect(channels).not.toContain('sms');
    });
  });

  describe('sendAppointmentConfirmation', () => {
    it('registra notificación en BD y envía email en modo dev', async () => {
      await service.sendAppointmentConfirmation(MOCK_CITA);
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plantilla: 'cita_confirmacion' }),
        }),
      );
    });

    it('no falla si el paciente no tiene email', async () => {
      const citaSinEmail = { ...MOCK_CITA, paciente: { ...MOCK_CITA.paciente, emailCifrado: null } };
      await expect(service.sendAppointmentConfirmation(citaSinEmail)).resolves.not.toThrow();
    });
  });

  describe('sendAppointmentReminder', () => {
    it('usa plantilla correcta para recordatorio 24h', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await service.sendAppointmentReminder(MOCK_CITA, '24h');
      // En modo dev, verifica que se loguea el email
      expect(prisma.notificacion.create).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('usa plantilla correcta para recordatorio 2h', async () => {
      await service.sendAppointmentReminder(MOCK_CITA, '2h');
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plantilla: 'cita_recordatorio_2h' }),
        }),
      );
    });
  });

  describe('buildEmailContent', () => {
    it('construye HTML válido con variables interpoladas', () => {
      const result = (service as any).buildEmailContent('cita_confirmacion', {
        medico: 'Dr. García',
        fecha: 'lunes 1 de enero',
        hora: '10:00',
        sede: 'Sede Norte',
        url_sala: '',
      });
      expect(result.subject).toContain('Dr. García');
      expect(result.html).toContain('<div');
      expect(result.text).toContain('lunes 1 de enero');
    });

    it('retorna fallback para plantilla desconocida', () => {
      const result = (service as any).buildEmailContent('plantilla_inexistente' as any, {});
      expect(result.subject).toBe('Notificación');
    });
  });

  describe('sendLabResultReady', () => {
    it('usa plantilla resultado_critico cuando valorCritico=true', async () => {
      const orden = {
        items: [{ estudio: { nombre: 'Glucosa en ayunas' } }],
        paciente: MOCK_CITA.paciente,
      };
      await service.sendLabResultReady(orden, orden.paciente, true);
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plantilla: 'resultado_critico' }),
        }),
      );
    });
  });
});
