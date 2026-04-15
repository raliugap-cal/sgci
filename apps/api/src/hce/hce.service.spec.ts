// ═══════════════════════════════════════════════════════════
// TESTS — hce.service.spec.ts
// Consultas · Notas SOAP · Vitales · Firma · CIE-10
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { HceService } from '../hce/hce.module';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';

const makePrisma = () => ({
  consulta: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notaClinica: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  versionNota: { create: jest.fn() },
  signosVitales: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  diagnostico: { create: jest.fn() },
  codigoCIE10: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  plantillaClinica: { findMany: jest.fn() },
  cita: { update: jest.fn() },
  auditoria: { create: jest.fn() },
});

const makeEncryption = () => ({
  signContent: jest.fn().mockReturnValue('sha256-firma-hash'),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
});

const makeAudit = () => ({ log: jest.fn() });

const MOCK_CONSULTA = {
  id: 'consulta-001',
  citaId: 'cita-001',
  pacienteId: 'pac-001',
  medicoId: 'medico-001',
  sedeId: 'sede-001',
  estado: 'EN_PROGRESO',
  esTelemedicina: false,
};

describe('HceService', () => {
  let service: HceService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: ReturnType<typeof makeEncryption>;

  beforeEach(async () => {
    prisma = makePrisma();
    encryption = makeEncryption();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: AuditService, useValue: makeAudit() },
      ],
    }).compile();
    service = module.get<HceService>(HceService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── openConsulta ────────────────────────────────────────
  describe('openConsulta', () => {
    it('crea una nueva consulta desde cita válida', async () => {
      prisma.consulta.findUnique.mockResolvedValue(null); // No existe aún
      prisma.consulta.create.mockResolvedValue(MOCK_CONSULTA);
      prisma.cita.update.mockResolvedValue({});
      prisma.consulta.findFirst = jest.fn().mockResolvedValue({
        id: 'cita-001',
        pacienteId: 'pac-001',
        esTelemedicina: false,
      });

      const result = await service.openConsulta(
        { citaId: 'cita-001' },
        'medico-001',
        'sede-001',
        'actor-001',
        '127.0.0.1',
      );

      expect(prisma.consulta.create).toHaveBeenCalledTimes(1);
    });

    it('retorna consulta existente si ya fue abierta', async () => {
      prisma.consulta.findUnique.mockResolvedValue(MOCK_CONSULTA);
      prisma.consulta.findFirst = jest.fn().mockResolvedValue({
        id: 'cita-001',
        pacienteId: 'pac-001',
        esTelemedicina: false,
      });

      const result = await service.openConsulta(
        { citaId: 'cita-001' },
        'medico-001',
        'sede-001',
        'actor-001',
        '127.0.0.1',
      );

      expect(prisma.consulta.create).not.toHaveBeenCalled();
      expect(result.id).toBe('consulta-001');
    });
  });

  // ─── createNota ──────────────────────────────────────────
  describe('createNota', () => {
    it('crea nota SOAP en consulta abierta', async () => {
      prisma.consulta.findFirst.mockResolvedValue(MOCK_CONSULTA);
      prisma.notaClinica.create.mockResolvedValue({ id: 'nota-001', ...MOCK_CONSULTA });

      const dto = {
        consultaId: 'consulta-001',
        tipoNota: 'SOAP' as any,
        subjetivo: 'Paciente refiere mejoría',
        objetivo: 'PA 120/80',
        evaluacion: 'Sin complicaciones',
        plan: 'Continuar tratamiento',
      };

      const result = await service.createNota(dto, 'medico-001', 'sede-001', 'actor-001', '127.0.0.1');
      expect(prisma.notaClinica.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipoNota: 'SOAP', subjetivo: 'Paciente refiere mejoría' }),
        }),
      );
    });

    it('lanza ForbiddenException si la consulta está firmada', async () => {
      prisma.consulta.findFirst.mockResolvedValue({ ...MOCK_CONSULTA, estado: 'FIRMADA' });

      await expect(service.createNota(
        { consultaId: 'consulta-001', tipoNota: 'SOAP' as any },
        'medico-001', 'sede-001', 'actor-001', '127.0.0.1',
      )).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── signNota ────────────────────────────────────────────
  describe('signNota', () => {
    it('firma nota con hash SHA-256 del contenido', async () => {
      const mockNota = { id: 'nota-001', medicoId: 'medico-001', firmada: false,
        subjetivo: 'S', objetivo: 'O', evaluacion: 'A', plan: 'P' };
      prisma.notaClinica.findFirst.mockResolvedValue(mockNota);
      prisma.notaClinica.update.mockResolvedValue({ ...mockNota, firmada: true, firmaHash: 'sha256-firma-hash' });

      const result = await service.signNota('nota-001', 'medico-001', 'sede-001', 'actor-001', '127.0.0.1');

      expect(encryption.signContent).toHaveBeenCalled();
      expect(prisma.notaClinica.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmada: true,
            firmaHash: 'sha256-firma-hash',
          }),
        }),
      );
    });

    it('lanza BadRequestException si nota ya está firmada', async () => {
      prisma.notaClinica.findFirst.mockResolvedValue({ id: 'nota-001', medicoId: 'medico-001', firmada: true });

      await expect(service.signNota('nota-001', 'medico-001', 'sede-001', 'actor-001', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si nota no pertenece al médico', async () => {
      prisma.notaClinica.findFirst.mockResolvedValue(null); // findFirst con medicoId retorna null

      await expect(service.signNota('nota-001', 'medico-diferente', 'sede-001', 'actor-001', '127.0.0.1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateNota ──────────────────────────────────────────
  describe('updateNota', () => {
    it('versiona la nota antes de actualizar', async () => {
      const mockNota = { id: 'nota-001', medicoId: 'medico-001', firmada: false, version: 2,
        subjetivo: 'Original', objetivo: 'O', evaluacion: 'A', plan: 'P' };
      prisma.notaClinica.findFirst.mockResolvedValue(mockNota);
      prisma.versionNota.create.mockResolvedValue({});
      prisma.notaClinica.update.mockResolvedValue({ ...mockNota, version: 3 });

      await service.updateNota('nota-001', { subjetivo: 'Actualizado' }, 'medico-001', 'sede-001', 'actor-001');

      // Debe versionar el contenido anterior
      expect(prisma.versionNota.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notaId: 'nota-001', version: 2 }),
        }),
      );
    });

    it('lanza ForbiddenException si nota está firmada', async () => {
      prisma.notaClinica.findFirst.mockResolvedValue({ id: 'nota-001', medicoId: 'medico-001', firmada: true });

      await expect(service.updateNota('nota-001', { subjetivo: 'X' }, 'medico-001', 'sede-001', 'actor-001'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ─── upsertSignosVitales ─────────────────────────────────
  describe('upsertSignosVitales', () => {
    it('calcula IMC automáticamente cuando hay peso y talla', async () => {
      prisma.signosVitales.upsert.mockResolvedValue({});

      const dto = { consultaId: 'consulta-001', pesoKg: 70, tallaCm: 170 };
      await service.upsertSignosVitales(dto, 'actor-001', 'sede-001');

      expect(prisma.signosVitales.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            imc: 24.2, // 70 / (1.70^2) = 24.22...
          }),
        }),
      );
    });

    it('no calcula IMC si falta peso o talla', async () => {
      prisma.signosVitales.upsert.mockResolvedValue({});

      await service.upsertSignosVitales({ consultaId: 'consulta-001', taSistolica: 120 }, 'actor-001', 'sede-001');

      expect(prisma.signosVitales.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ imc: undefined }),
        }),
      );
    });
  });

  // ─── searchCie10 ─────────────────────────────────────────
  describe('searchCie10', () => {
    it('busca por código y descripción', async () => {
      const mockResults = [
        { id: '1', codigo: 'F10', descripcion: 'Trastornos por alcohol' },
        { id: '2', codigo: 'F10.1', descripcion: 'Uso nocivo del alcohol' },
      ];
      prisma.codigoCIE10.findMany.mockResolvedValue(mockResults);

      const result = await service.searchCie10('F10');
      expect(prisma.codigoCIE10.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activo: true }),
          take: 20,
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  // ─── closeConsulta ───────────────────────────────────────
  describe('closeConsulta', () => {
    it('rechaza cerrar consulta sin notas', async () => {
      prisma.consulta.findFirst.mockResolvedValue(MOCK_CONSULTA);
      prisma.notaClinica.count.mockResolvedValue(0);

      await expect(service.closeConsulta('consulta-001', 'medico-001', 'sede-001', 'actor-001', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('cierra consulta exitosamente con notas', async () => {
      prisma.consulta.findFirst.mockResolvedValue(MOCK_CONSULTA);
      prisma.notaClinica.count.mockResolvedValue(1);
      prisma.consulta.update.mockResolvedValue({ ...MOCK_CONSULTA, estado: 'FIRMADA' });
      prisma.cita.update.mockResolvedValue({});

      const result = await service.closeConsulta('consulta-001', 'medico-001', 'sede-001', 'actor-001', '127.0.0.1');
      expect(result.estado).toBe('FIRMADA');
    });
  });
});
