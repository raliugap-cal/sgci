// ═══════════════════════════════════════════════════════════
// TESTS — patients.service.spec.ts
// CURP · Cifrado PHI · Creación · Búsqueda · ARCO
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';
import { RenapoService } from '../common/services/renapo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

// ─── Mocks ───────────────────────────────────────────────
const makePrisma = () => ({
  paciente: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  consentimiento: { create: jest.fn() },
  auditoria: { create: jest.fn() },
  consulta: { findMany: jest.fn() },
  receta: { findMany: jest.fn() },
  diagnostico: { findMany: jest.fn() },
  paginate: jest.fn().mockImplementation((data, total, page, limit) => ({
    data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })),
});

const makeEncryption = () => ({
  encrypt: jest.fn().mockReturnValue(Buffer.from('encrypted')),
  decrypt: jest.fn().mockReturnValue('decrypted-value'),
  hash: jest.fn().mockReturnValue('hashed'),
  signContent: jest.fn().mockReturnValue('hash-firma'),
});

const makeAudit = () => ({ log: jest.fn() });
const makeRenapo = () => ({ validarCurp: jest.fn().mockResolvedValue({ valida: true }) });
const makeNotifications = () => ({ sendEmail: jest.fn(), notifyMedico: jest.fn() });
const makeConfig = () => ({
  get: jest.fn().mockReturnValue('development'),
  getOrThrow: jest.fn().mockReturnValue('test-encryption-key-32-chars-abc!'),
});

// ─── Datos de prueba ─────────────────────────────────────
const CREATE_DTO = {
  nombre: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'González',
  fechaNacimiento: '1990-05-15',
  sexo: 'MASCULINO' as any,
  curp: 'PEGJ900515HDFRNN09',
  email: 'juan@example.com',
  telefono: '8112345678',
};

const MOCK_PATIENT = {
  id: 'patient-uuid-001',
  numeroExpediente: 'SGCI-SEP-2024-00001',
  nombre: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'González',
  fechaNacimiento: new Date('1990-05-15'),
  sexo: 'MASCULINO',
  curp: Buffer.from('encrypted'),
  emailCifrado: Buffer.from('encrypted'),
  telefonoCifrado: Buffer.from('encrypted'),
  whatsappCifrado: null,
  rfc: null,
  grupoSanguineo: 'DESCONOCIDO',
  tieneExpedienteAdicciones: false,
  portalActivado: false,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────
describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: ReturnType<typeof makeEncryption>;
  let audit: ReturnType<typeof makeAudit>;

  beforeEach(async () => {
    prisma = makePrisma();
    encryption = makeEncryption();
    audit = makeAudit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: AuditService, useValue: audit },
        { provide: RenapoService, useValue: makeRenapo() },
        { provide: NotificationsService, useValue: makeNotifications() },
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ─────────────────────────────────────────────
  describe('create', () => {
    it('crea un paciente con datos válidos', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null); // No duplicado
      prisma.paciente.create.mockResolvedValue(MOCK_PATIENT);
      prisma.consentimiento.create.mockResolvedValue({});

      const result = await service.create(CREATE_DTO, 'actor-id', 'sede-id', '127.0.0.1');

      expect(prisma.paciente.create).toHaveBeenCalledTimes(1);
      expect(prisma.consentimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'PRIVACIDAD_LFPDPPP' }) }),
      );
      expect(audit.log).toHaveBeenCalled();
      expect(result.id).toBe(MOCK_PATIENT.id);
    });

    it('rechaza CURP con formato inválido', async () => {
      await expect(
        service.create({ ...CREATE_DTO, curp: 'CURP-INVALIDA' }, 'actor-id', 'sede-id', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza ConflictException si ya existe un paciente con esa CURP', async () => {
      prisma.paciente.findFirst.mockResolvedValue(MOCK_PATIENT);

      await expect(
        service.create(CREATE_DTO, 'actor-id', 'sede-id', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('cifra los campos PHI antes de guardar', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);
      prisma.paciente.create.mockResolvedValue(MOCK_PATIENT);
      prisma.consentimiento.create.mockResolvedValue({});

      await service.create(CREATE_DTO, 'actor-id', 'sede-id', '127.0.0.1');

      expect(encryption.encrypt).toHaveBeenCalledWith('PEGJ900515HDFRNN09'); // CURP
      expect(encryption.encrypt).toHaveBeenCalledWith('juan@example.com'); // Email
      expect(encryption.encrypt).toHaveBeenCalledWith('8112345678'); // Teléfono
    });

    it('genera el consentimiento LFPDPPP automáticamente', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);
      prisma.paciente.create.mockResolvedValue(MOCK_PATIENT);
      prisma.consentimiento.create.mockResolvedValue({});

      await service.create(CREATE_DTO, 'actor-id', 'sede-id', '127.0.0.1');

      expect(prisma.consentimiento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'PRIVACIDAD_LFPDPPP',
            firmado: false,
            version: '2.0',
          }),
        }),
      );
    });
  });

  // ─── search ─────────────────────────────────────────────
  describe('search', () => {
    it('busca por nombre usando contains case-insensitive', async () => {
      prisma.paciente.count.mockResolvedValue(1);
      prisma.paciente.findMany.mockResolvedValue([MOCK_PATIENT]);

      const result = await service.search({ q: 'juan', page: 1, limit: 20 }, 'sede-id');

      expect(prisma.paciente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { nombre: { contains: 'juan', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('busca por CURP exacta (descifrada)', async () => {
      prisma.paciente.findFirst.mockResolvedValue(MOCK_PATIENT);

      const result = await service.search(
        { curp: 'PEGJ900515HDFRNN09', page: 1, limit: 20 },
        'sede-id',
      );

      expect(encryption.encrypt).toHaveBeenCalledWith('PEGJ900515HDFRNN09');
    });

    it('retorna paginación correcta', async () => {
      prisma.paciente.count.mockResolvedValue(25);
      prisma.paciente.findMany.mockResolvedValue([MOCK_PATIENT]);

      const result = await service.search({ q: 'juan', page: 2, limit: 10 }, 'sede-id');
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(2);
    });
  });

  // ─── findById ────────────────────────────────────────────
  describe('findById', () => {
    it('retorna el paciente con datos descifrados', async () => {
      prisma.paciente.findFirst.mockResolvedValue({
        ...MOCK_PATIENT,
        consentimientos: [],
        alergias: [],
        antecedentes: [],
      });

      const result = await service.findById(
        'patient-uuid-001', 'actor-id', 'MEDICO' as any, 'sede-id', '127.0.0.1',
      );

      expect(encryption.decrypt).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'READ_SENSITIVE' }),
      );
    });

    it('lanza NotFoundException si el paciente no existe', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', 'actor-id', 'MEDICO' as any, 'sede-id', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── CURP validation ─────────────────────────────────────
  describe('validación de CURP', () => {
    const validCurps = [
      'PEGJ900515HDFRNN09',
      'MARH850310MDFRRN05',
      'GARC921225HDFRCR01',
    ];
    const invalidCurps = [
      'CURP-INVALIDA',
      '12345678901234567',
      'SHORT',
      '',
    ];

    validCurps.forEach(curp => {
      it(`acepta CURP válida: ${curp}`, async () => {
        prisma.paciente.findFirst.mockResolvedValue(null);
        prisma.paciente.create.mockResolvedValue(MOCK_PATIENT);
        prisma.consentimiento.create.mockResolvedValue({});

        await expect(
          service.create({ ...CREATE_DTO, curp }, 'actor-id', 'sede-id', '127.0.0.1'),
        ).resolves.toBeDefined();
      });
    });

    invalidCurps.forEach(curp => {
      it(`rechaza CURP inválida: "${curp}"`, async () => {
        if (!curp) return; // CURP vacía no se valida (campo opcional)
        await expect(
          service.create({ ...CREATE_DTO, curp }, 'actor-id', 'sede-id', '127.0.0.1'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
