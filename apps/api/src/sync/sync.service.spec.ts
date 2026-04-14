// ═══════════════════════════════════════════════════════════
// TESTS — sync.service.spec.ts
// Staff sync · Patient sync · Delta sync · Conflictos
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';

const makePrisma = () => ({
  notaClinica: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  signosVitales: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notaSesion: { create: jest.fn() },
  diarioConsumo: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  mensajePortal: { create: jest.fn() },
  expedienteAdiccion: { findFirst: jest.fn() },
  versionNota: { create: jest.fn() },
  cita: { findMany: jest.fn().mockResolvedValue([]) },
  ordenLaboratorio: { findMany: jest.fn().mockResolvedValue([]) },
  receta: { findMany: jest.fn().mockResolvedValue([]) },
  diagnostico: { findMany: jest.fn().mockResolvedValue([]) },
  alergia: { findMany: jest.fn().mockResolvedValue([]) },
  paciente: { findUniqueOrThrow: jest.fn() },
  auditoria: { create: jest.fn() },
  paginate: jest.fn(),
});

const makeAudit = () => ({ log: jest.fn() });

describe('SyncService', () => {
  let service: SyncService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: makeAudit() },
      ],
    }).compile();
    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Staff sync ─────────────────────────────────────────
  describe('syncStaff', () => {
    it('procesa registros de notas en orden cronológico', async () => {
      prisma.notaClinica.findFirst.mockResolvedValue(null);
      prisma.notaClinica.create.mockResolvedValue({ id: 'nota-001' });
      prisma.cita.findMany.mockResolvedValue([]);

      const payload = {
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'test-device',
        records: [
          {
            id: 'r2',
            type: 'nota_clinica' as const,
            data: { consultaId: 'c-001', tipoNota: 'SOAP', subjetivo: 'Segundo' },
            timestampLocal: new Date(Date.now() + 1000).toISOString(),
            deviceId: 'test-device',
          },
          {
            id: 'r1',
            type: 'nota_clinica' as const,
            data: { consultaId: 'c-001', tipoNota: 'SOAP', subjetivo: 'Primero' },
            timestampLocal: new Date(Date.now()).toISOString(),
            deviceId: 'test-device',
          },
        ],
      };

      const result = await service.syncStaff(payload, 'actor-001', 'sede-001', '127.0.0.1');
      expect(result.synced).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('detecta conflicto cuando nota ya está firmada', async () => {
      prisma.notaClinica.findFirst.mockResolvedValue({
        id: 'nota-001',
        firmada: true,
        updatedAt: new Date(),
        actorId: 'otro-actor',
      });
      prisma.cita.findMany.mockResolvedValue([]);

      const payload = {
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'test-device',
        records: [{
          id: 'r1',
          type: 'nota_clinica' as const,
          data: { consultaId: 'c-001', tipoNota: 'SOAP', subjetivo: 'Modificación' },
          timestampLocal: new Date().toISOString(),
          deviceId: 'test-device',
        }],
      };

      const result = await service.syncStaff(payload, 'actor-001', 'sede-001', '127.0.0.1');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toContain('firmada');
    });

    it('retorna cambios del servidor desde lastSync', async () => {
      const citaNueva = { id: 'cita-nueva', estado: 'CONFIRMADA', updatedAt: new Date() };
      prisma.cita.findMany.mockResolvedValue([citaNueva]);

      const result = await service.syncStaff(
        { lastSyncAt: new Date(0).toISOString(), deviceId: 'dev', records: [] },
        'actor-001', 'sede-001', '127.0.0.1',
      );

      expect(result.serverChanges.citasActualizadas).toHaveLength(1);
    });
  });

  // ─── Patient sync ────────────────────────────────────────
  describe('syncPatient', () => {
    it('sincroniza entrada del diario de adicciones', async () => {
      prisma.expedienteAdiccion.findFirst.mockResolvedValue({ id: 'exp-001', pacienteId: 'pac-001' });
      prisma.diarioConsumo.findFirst.mockResolvedValue(null); // Sin duplicado
      prisma.diarioConsumo.create.mockResolvedValue({ id: 'diario-001' });

      const payload = {
        pacienteId: 'pac-001',
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'mobile-device',
        diaryEntries: [{
          id: 'local-diary-001',
          expedienteAdiccionId: 'exp-001',
          fecha: new Date().toISOString().substring(0, 10),
          huboConsumo: false,
          estadoAnimo: 8,
          nivelAnsiedad: 3,
          timestampLocal: new Date().toISOString(),
        }],
        messages: [],
      };

      const result = await service.syncPatient(payload, '127.0.0.1');
      expect(result.synced).toBe(1);
      expect(prisma.diarioConsumo.create).toHaveBeenCalled();
    });

    it('no duplica entradas del mismo día', async () => {
      prisma.expedienteAdiccion.findFirst.mockResolvedValue({ id: 'exp-001', pacienteId: 'pac-001' });
      // Simula registro existente más reciente que el offline
      prisma.diarioConsumo.findFirst.mockResolvedValue({
        id: 'diario-existing',
        createdAt: new Date(Date.now() + 5000), // Más reciente que timestampLocal
      });

      const payload = {
        pacienteId: 'pac-001',
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'mobile-device',
        diaryEntries: [{
          id: 'local-diary-001',
          expedienteAdiccionId: 'exp-001',
          fecha: new Date().toISOString().substring(0, 10),
          huboConsumo: false,
          timestampLocal: new Date(Date.now() - 5000).toISOString(), // Más antiguo
        }],
        messages: [],
      };

      const result = await service.syncPatient(payload, '127.0.0.1');
      // El registro existente es más reciente — no sobrescribir
      expect(prisma.diarioConsumo.update).not.toHaveBeenCalled();
    });

    it('sincroniza mensajes offline', async () => {
      prisma.mensajePortal.create.mockResolvedValue({ id: 'msg-001' });

      const payload = {
        pacienteId: 'pac-001',
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'mobile-device',
        diaryEntries: [],
        messages: [{
          id: 'local-msg-001',
          sedeId: 'sede-001',
          asunto: 'Consulta sobre receta',
          contenido: 'Buenos días, tengo una pregunta...',
          timestampLocal: new Date().toISOString(),
        }],
      };

      const result = await service.syncPatient(payload, '127.0.0.1');
      expect(result.synced).toBe(1);
      expect(prisma.mensajePortal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creadoOffline: true,
            syncPending: false,
          }),
        }),
      );
    });

    it('rechaza diario si expediente no pertenece al paciente', async () => {
      prisma.expedienteAdiccion.findFirst.mockResolvedValue(null); // No pertenece

      const payload = {
        pacienteId: 'pac-001',
        lastSyncAt: new Date(0).toISOString(),
        deviceId: 'mobile-device',
        diaryEntries: [{
          id: 'local-diary-001',
          expedienteAdiccionId: 'exp-de-otro-paciente',
          fecha: new Date().toISOString().substring(0, 10),
          huboConsumo: false,
          timestampLocal: new Date().toISOString(),
        }],
        messages: [],
      };

      const result = await service.syncPatient(payload, '127.0.0.1');
      expect(result.errors).toHaveLength(1);
      expect(prisma.diarioConsumo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Prefetch ────────────────────────────────────────────
  describe('getPrefetchData', () => {
    it('retorna estructura completa para el portal offline', async () => {
      // Mock de todas las consultas paralelas
      const mocks: Record<string, any> = {
        cita: [{ id: 'c1', fechaInicio: new Date().toISOString() }],
        diagnostico: [{ id: 'd1', cie10: { codigo: 'F10' } }],
        alergia: [{ id: 'a1', agente: 'Penicilina' }],
        receta: [{ id: 'r1', estado: 'ACTIVA', items: [] }],
      };

      prisma.cita.findMany.mockResolvedValue(mocks.cita);
      prisma.diagnostico.findMany.mockResolvedValue(mocks.diagnostico);
      prisma.alergia.findMany.mockResolvedValue(mocks.alergia);
      prisma.receta.findMany.mockResolvedValue(mocks.receta);
      prisma.ordenLaboratorio.findMany = jest.fn().mockResolvedValue([]);
      prisma.mensajePortal = { findMany: jest.fn().mockResolvedValue([]) } as any;
      prisma.diarioConsumo = { findMany: jest.fn().mockResolvedValue([]) } as any;

      const result = await service.getPrefetchData('pac-001');

      expect(result).toHaveProperty('citas');
      expect(result).toHaveProperty('alergias');
      expect(result).toHaveProperty('diagnosticosActivos');
      expect(result).toHaveProperty('generadoAt');
      expect(result).toHaveProperty('ttlSeconds', 300);
    });
  });
});
