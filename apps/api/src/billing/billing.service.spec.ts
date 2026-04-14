// ═══════════════════════════════════════════════════════════
// TESTS — billing.service.spec.ts
// CFDI 4.0 · Timbrado · Pagos · QuickBooks standby
// ═══════════════════════════════════════════════════════════
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../database/prisma.service';
import { PacService } from './billing.module';
import { SatService } from './billing.module';
import { QuickBooksService } from './billing.module';
import { FilesService } from '../files/files.module';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/services/audit.service';
import { ConfigService } from '@nestjs/config';

const makePrisma = () => ({
  factura: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  cargo: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  pago: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  cortesCaja: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  servicioCatalogo: { findFirst: jest.fn() },
  $transaction: jest.fn().mockImplementation(async (fn) => fn(makePrisma())),
  paginate: jest.fn().mockImplementation((data, total, page, limit) => ({ data, meta: { total, page, limit } })),
});

const makePac = () => ({
  timbraComprobante: jest.fn().mockResolvedValue({
    uuid: 'test-uuid-1234',
    xmlTimbrado: '<cfdi:Comprobante/>',
    fechaTimbrado: new Date(),
  }),
  cancelarComprobante: jest.fn().mockResolvedValue(undefined),
});

const makeSat = () => ({ validateRfc: jest.fn().mockResolvedValue(true) });
const makeQb = () => ({ enqueueSync: jest.fn().mockResolvedValue(undefined) });
const makeFiles = () => ({ upload: jest.fn().mockResolvedValue('s3://bucket/key.xml') });
const makeNotifications = () => ({ sendInvoiceEmail: jest.fn().mockResolvedValue(undefined) });
const makeAudit = () => ({ log: jest.fn() });
const makeConfig = () => ({ get: jest.fn(), getOrThrow: jest.fn() });

const MOCK_FACTURA_BASE = {
  id: 'factura-001',
  sedeId: 'sede-001',
  pacienteId: 'pac-001',
  numeroFacturaInterno: 'FAC-202401-00001',
  estadoCfdi: 'BORRADOR',
  estadoPago: 'PENDIENTE',
  subtotal: 500,
  iva: 0,
  total: 500,
  montoPagado: 0,
  saldo: 500,
  qbSyncPending: true,
  cargos: [],
  pagos: [],
  paciente: { nombre: 'Ana', apellidoPaterno: 'López', emailCifrado: null },
  sede: { rfc: 'CIN220101ABC', razonSocial: 'CLÍNICA TEST SA DE CV', pacUrl: null, pacUser: null, pacPass: null },
};

describe('BillingService', () => {
  let service: BillingService;
  let prisma: ReturnType<typeof makePrisma>;
  let pac: ReturnType<typeof makePac>;
  let sat: ReturnType<typeof makeSat>;
  let qb: ReturnType<typeof makeQb>;

  beforeEach(async () => {
    prisma = makePrisma();
    pac = makePac();
    sat = makeSat();
    qb = makeQb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: PacService, useValue: pac },
        { provide: SatService, useValue: sat },
        { provide: QuickBooksService, useValue: qb },
        { provide: FilesService, useValue: makeFiles() },
        { provide: NotificationsService, useValue: makeNotifications() },
        { provide: AuditService, useValue: makeAudit() },
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ─────────────────────────────────────────────
  describe('create', () => {
    it('crea pre-factura con datos básicos', async () => {
      prisma.factura.create.mockResolvedValue(MOCK_FACTURA_BASE);
      prisma.factura.findUniqueOrThrow.mockResolvedValue(MOCK_FACTURA_BASE);
      prisma.factura.count.mockResolvedValue(0);

      const result = await service.create(
        { pacienteId: 'pac-001' },
        'actor-001',
        'sede-001',
        '127.0.0.1',
      );

      expect(prisma.factura.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estadoCfdi: 'BORRADOR',
            qbSyncPending: true,  // Siempre true — QB en standby
          }),
        }),
      );
    });

    it('QB sync siempre marcado como pendiente en MVP', async () => {
      prisma.factura.create.mockResolvedValue(MOCK_FACTURA_BASE);
      prisma.factura.findUniqueOrThrow.mockResolvedValue(MOCK_FACTURA_BASE);
      prisma.factura.count.mockResolvedValue(0);

      await service.create({ pacienteId: 'pac-001' }, 'actor-001', 'sede-001', '127.0.0.1');

      const createCall = prisma.factura.create.mock.calls[0][0];
      expect(createCall.data.qbSyncPending).toBe(true);
    });
  });

  // ─── addCharge ──────────────────────────────────────────
  describe('addCharge', () => {
    it('agrega cargo y recalcula totales', async () => {
      prisma.factura.findFirst.mockResolvedValue(MOCK_FACTURA_BASE);
      prisma.cargo.create.mockResolvedValue({});
      prisma.cargo.findMany.mockResolvedValue([
        { subtotal: 500, iva: 0, total: 500 },
      ]);
      prisma.factura.update.mockResolvedValue({ ...MOCK_FACTURA_BASE, subtotal: 500, total: 500 });

      await service.addCharge(
        'factura-001',
        {
          concepto: 'Consulta de seguimiento',
          claveSAT: '93101601',
          precioUnitario: 500,
          cantidad: 1,
          ivaAplicable: false,
        },
        'actor-001',
        'sede-001',
      );

      expect(prisma.cargo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ facturaId: 'factura-001' }),
        }),
      );
    });

    it('rechaza agregar cargo a factura ya timbrada', async () => {
      prisma.factura.findFirst.mockResolvedValue({ ...MOCK_FACTURA_BASE, estadoCfdi: 'TIMBRADO' });

      await expect(service.addCharge(
        'factura-001',
        { concepto: 'Test', claveSAT: '001', precioUnitario: 100, cantidad: 1 },
        'actor-001',
        'sede-001',
      )).rejects.toThrow(BadRequestException);
    });
  });

  // ─── stamp (timbrado CFDI) ───────────────────────────────
  describe('stamp', () => {
    it('timbra CFDI exitosamente con PAC', async () => {
      const facturaConCargos = {
        ...MOCK_FACTURA_BASE,
        estadoCfdi: 'BORRADOR',
        cargos: [{ id: 'c1', concepto: 'Consulta', claveSAT: '001', claveUnidadSAT: 'E48',
          precioUnitario: 500, cantidad: 1, descuento: 0, subtotal: 500, ivaAplicable: false,
          tasaIva: 0, iva: 0, total: 500 }],
      };
      prisma.factura.findFirst.mockResolvedValue(facturaConCargos);
      prisma.factura.update.mockResolvedValue({ ...facturaConCargos, estadoCfdi: 'TIMBRADO', cfdiUuid: 'test-uuid-1234' });

      const result = await service.stamp('factura-001', 'actor-001', 'sede-001', '127.0.0.1');

      expect(pac.timbraComprobante).toHaveBeenCalledTimes(1);
      expect(qb.enqueueSync).toHaveBeenCalledWith('factura-001');
    });

    it('rechaza timbrar factura sin cargos', async () => {
      prisma.factura.findFirst.mockResolvedValue({ ...MOCK_FACTURA_BASE, cargos: [] });

      await expect(service.stamp('factura-001', 'actor-001', 'sede-001', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('rechaza timbrar factura ya timbrada', async () => {
      prisma.factura.findFirst.mockResolvedValue({ ...MOCK_FACTURA_BASE, estadoCfdi: 'TIMBRADO', cargos: [{}] });

      await expect(service.stamp('factura-001', 'actor-001', 'sede-001', '127.0.0.1'))
        .rejects.toThrow(BadRequestException);
    });

    it('lanza InternalServerError si PAC falla', async () => {
      prisma.factura.findFirst.mockResolvedValue({ ...MOCK_FACTURA_BASE, cargos: [{ id: 'c1', claveSAT: '001', claveUnidadSAT: 'E48', precioUnitario: 500, cantidad: 1, subtotal: 500, ivaAplicable: false, tasaIva: 0, iva: 0, total: 500, descuento: 0, concepto: 'Test' }] });
      pac.timbraComprobante.mockRejectedValue(new Error('PAC no disponible'));

      await expect(service.stamp('factura-001', 'actor-001', 'sede-001', '127.0.0.1'))
        .rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── registerPayment ─────────────────────────────────────
  describe('registerPayment', () => {
    it('registra pago y actualiza saldo', async () => {
      const facturaTimbrada = { ...MOCK_FACTURA_BASE, estadoCfdi: 'TIMBRADO', cfdiUuid: 'uuid-001' };
      prisma.factura.findFirst.mockResolvedValue(facturaTimbrada);
      prisma.$transaction.mockImplementation(async (fn) => fn({
        pago: { create: jest.fn() },
        factura: { update: jest.fn().mockResolvedValue({}) },
      }));
      prisma.factura.findUniqueOrThrow.mockResolvedValue({
        ...facturaTimbrada, montoPagado: 500, saldo: 0, estadoPago: 'PAGADO', pagos: [], cargos: [],
      });

      const result = await service.registerPayment(
        'factura-001',
        { monto: 500, metodoPago: 'EFECTIVO' as any },
        'actor-001',
        'sede-001',
        '127.0.0.1',
      );

      expect(qb.enqueueSync).toHaveBeenCalledWith('factura-001');
    });

    it('rechaza pago en factura ya pagada', async () => {
      prisma.factura.findFirst.mockResolvedValue({ ...MOCK_FACTURA_BASE, estadoPago: 'PAGADO' });

      await expect(service.registerPayment(
        'factura-001',
        { monto: 100, metodoPago: 'EFECTIVO' as any },
        'actor-001', 'sede-001', '127.0.0.1',
      )).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ─────────────────────────────────────────────
  describe('findAll', () => {
    it('retorna facturas paginadas de la sede', async () => {
      prisma.factura.count.mockResolvedValue(5);
      prisma.factura.findMany.mockResolvedValue([MOCK_FACTURA_BASE]);

      const result = await service.findAll({ sedeId: 'sede-001', page: 1, limit: 20 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('filtra por estado CFDI', async () => {
      prisma.factura.count.mockResolvedValue(2);
      prisma.factura.findMany.mockResolvedValue([]);

      await service.findAll({ sedeId: 'sede-001', estado: 'TIMBRADO', page: 1, limit: 20 });
      expect(prisma.factura.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estadoCfdi: 'TIMBRADO' }),
        }),
      );
    });
  });

  // ─── exportAccounting ────────────────────────────────────
  describe('exportAccounting', () => {
    it('genera CSV compatible con QuickBooks', async () => {
      prisma.factura.findMany.mockResolvedValue([{
        ...MOCK_FACTURA_BASE,
        cfdiUuid: 'uuid-001',
        fechaTimbrado: new Date(),
        cargos: [{ claveSAT: '001', claveUnidadSAT: 'E48', concepto: 'Consulta', precioUnitario: 500, cantidad: 1, iva: 0, ivaAplicable: false }],
        pagos: [],
      }]);

      const csv = await service.exportAccounting('sede-001', new Date(), new Date(), 'csv_qbo');
      expect(typeof csv).toBe('string');
      expect(csv).toContain('*InvoiceNo');
    });

    it('genera reporte Excel para exportación contable', async () => {
      prisma.factura.findMany.mockResolvedValue([{ ...MOCK_FACTURA_BASE, cargos: [], pagos: [] }]);

      const result = await service.exportAccounting('sede-001', new Date(), new Date(), 'xlsx');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
