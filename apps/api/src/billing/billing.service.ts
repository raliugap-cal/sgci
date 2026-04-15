// ═══════════════════════════════════════════════════════════
// BILLING SERVICE — CFDI 4.0 · SAT · QuickBooks (standby)
// ═══════════════════════════════════════════════════════════
import {
  Injectable, NotFoundException, BadRequestException,
  Logger, InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { AuditService } from '../common/services/audit.service';
import { PacService } from './services/pac.service';
import { SatService } from './services/sat.service';
import { QuickBooksService } from './services/quickbooks.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddChargeDto } from './dto/add-charge.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { EstadoCFDI, EstadoPago, MetodoPagoSAT } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { generateFacturaNumber } from '../common/utils/generators';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private pac: PacService,
    private sat: SatService,
    private qb: QuickBooksService,
    private files: FilesService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  // ─── Crear pre-factura ────────────────────────────────────
  async create(dto: CreateInvoiceDto, actorId: string, sedeId: string, ip: string) {
    const numeroFactura = await generateFacturaNumber(this.prisma, sedeId);

    const factura = await this.prisma.factura.create({
      data: {
        pacienteId: dto.pacienteId,
        consultaId: dto.consultaId,
        sedeId,
        numeroFacturaInterno: numeroFactura,
        rfcReceptor: dto.rfcReceptor,
        razonSocialReceptor: dto.razonSocialReceptor,
        regimenFiscalReceptor: dto.regimenFiscalReceptor,
        usoCfdi: dto.usoCfdi ?? 'G03', // Gastos en general (default para servicios médicos)
        subtotal: 0,
        iva: 0,
        total: 0,
        saldo: 0,
        estadoCfdi: EstadoCFDI.BORRADOR,
        estadoPago: EstadoPago.PENDIENTE,
        qbSyncPending: true, // Siempre true — sync cuando QB esté activo
        actorId,
      },
    });

    // Si viene de una consulta, pre-cargar servicios automáticamente
    if (dto.consultaId) {
      await this.preloadConsultationCharges(factura.id, dto.consultaId, sedeId);
      await this.recalcTotals(factura.id);
    }

    return this.prisma.factura.findUniqueOrThrow({
      where: { id: factura.id },
      include: { cargos: { include: { servicio: true } }, paciente: true },
    });
  }

  // ─── Agregar cargo ────────────────────────────────────────
  async addCharge(facturaId: string, dto: AddChargeDto, actorId: string, sedeId: string) {
    const factura = await this.prisma.factura.findFirst({ where: { id: facturaId, sedeId } });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estadoCfdi !== EstadoCFDI.BORRADOR) {
      throw new BadRequestException('No se pueden agregar cargos a una factura ya timbrada');
    }

    const ivaAmount = dto.ivaAplicable ? dto.precioUnitario * dto.cantidad * dto.tasaIva : 0;
    const subtotal = dto.precioUnitario * dto.cantidad - dto.descuento;

    await this.prisma.cargo.create({
      data: {
        facturaId,
        servicioId: dto.servicioId,
        concepto: dto.concepto,
        claveSAT: dto.claveSAT,
        claveUnidadSAT: dto.claveUnidadSAT ?? 'E48', // Unidad de servicio
        precioUnitario: dto.precioUnitario,
        cantidad: dto.cantidad,
        descuento: dto.descuento ?? 0,
        subtotal,
        ivaAplicable: dto.ivaAplicable ?? false,
        tasaIva: dto.tasaIva ?? 0,
        iva: ivaAmount,
        total: subtotal + ivaAmount,
      },
    });

    return this.recalcTotals(facturaId);
  }

  // ─── Timbrar CFDI 4.0 ─────────────────────────────────────
  async stamp(facturaId: string, actorId: string, sedeId: string, ip: string) {
    const factura = await this.prisma.factura.findFirst({
      where: { id: facturaId, sedeId },
      include: {
        cargos: true,
        paciente: true,
        sede: true,
      },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estadoCfdi !== EstadoCFDI.BORRADOR) {
      throw new BadRequestException('La factura ya fue timbrada');
    }
    if (factura.cargos.length === 0) {
      throw new BadRequestException('La factura no tiene cargos');
    }

    // 1. Validar RFC con SAT (si se requiere factura fiscal)
    if (factura.rfcReceptor && factura.rfcReceptor !== 'XAXX010101000') {
      const rfcValido = await this.sat.validateRfc(factura.rfcReceptor);
      if (!rfcValido) {
        throw new BadRequestException(`RFC ${factura.rfcReceptor} no encontrado en la lista del SAT`);
      }
    }

    // 2. Construir XML CFDI 4.0
    const cfdiXml = this.buildCfdi40(factura);

    // 3. Timbrar vía PAC
    let cfdiTimbrado: { uuid: string; xmlTimbrado: string; fechaTimbrado: Date };
    try {
      cfdiTimbrado = await this.pac.timbraComprobante(factura.sede, cfdiXml);
    } catch (e) {
      this.logger.error(`Error PAC al timbrar factura ${facturaId}: ${e.message}`);
      throw new InternalServerErrorException('Error al timbrar con el PAC. Intente nuevamente.');
    }

    // 4. Subir XML y PDF a S3
    const xmlKey = `cfdi/${sedeId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${cfdiTimbrado.uuid}.xml`;
    const xmlUrl = await this.files.upload(
      Buffer.from(cfdiTimbrado.xmlTimbrado),
      xmlKey,
      'application/xml',
    );

    const pdfBuffer = await this.generateFacturaPdf(factura, cfdiTimbrado.uuid);
    const pdfKey = xmlKey.replace('.xml', '.pdf');
    const pdfUrl = await this.files.upload(pdfBuffer, pdfKey, 'application/pdf');

    // 5. Actualizar factura
    const updated = await this.prisma.factura.update({
      where: { id: facturaId },
      data: {
        cfdiUuid: cfdiTimbrado.uuid,
        cfdiXmlUrl: xmlUrl,
        cfdiPdfUrl: pdfUrl,
        estadoCfdi: EstadoCFDI.TIMBRADO,
        fechaTimbrado: cfdiTimbrado.fechaTimbrado,
        actorId,
      },
      include: { paciente: true, cargos: true },
    });

    // 6. Encolar sync con QuickBooks (si está activo)
    await this.qb.enqueueSync(facturaId);

    // 7. Enviar por email al paciente
    // (Email en MVP — WA cuando esté activo)
    await this.notifications.sendInvoiceEmail(updated, xmlUrl, pdfUrl);

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'STAMP_CFDI',
      recursoTipo: 'factura',
      recursoId: facturaId,
      datosNuevos: { cfdiUuid: cfdiTimbrado.uuid, total: String(factura.total) },
    });

    return updated;
  }

  // ─── Registrar pago ───────────────────────────────────────
  async registerPayment(facturaId: string, dto: RegisterPaymentDto, actorId: string, sedeId: string, ip: string) {
    const factura = await this.prisma.factura.findFirst({
      where: { id: facturaId, sedeId },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estadoPago === EstadoPago.PAGADO) {
      throw new BadRequestException('La factura ya está pagada');
    }

    const nuevaMontoPagado = Number(factura.montoPagado) + dto.monto;
    const nuevoSaldo = Number(factura.total) - nuevaMontoPagado;
    const nuevoEstado = nuevoSaldo <= 0 ? EstadoPago.PAGADO : EstadoPago.PAGADO_PARCIAL;

    await this.prisma.$transaction(async (tx) => {
      await tx.pago.create({
        data: {
          facturaId,
          monto: dto.monto,
          metodoPago: dto.metodoPago,
          referencia: dto.referencia,
          conektaChargeId: dto.conektaChargeId,
          notas: dto.notas,
          actorId,
        },
      });

      await tx.factura.update({
        where: { id: facturaId },
        data: {
          montoPagado: nuevaMontoPagado,
          saldo: Math.max(0, nuevoSaldo),
          estadoPago: nuevoEstado,
        },
      });
    });

    // Si factura ya timbrada y pago completo — generar Complemento de Pago CFDI
    if (factura.cfdiUuid && nuevoEstado === EstadoPago.PAGADO) {
      await this.generatePaymentComplement(facturaId, dto);
    }

    // Actualizar sync QB
    await this.qb.enqueueSync(facturaId);

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'REGISTER_PAYMENT',
      recursoTipo: 'factura',
      recursoId: facturaId,
      datosNuevos: { monto: dto.monto, metodo: dto.metodoPago },
    });

    return this.prisma.factura.findUniqueOrThrow({
      where: { id: facturaId },
      include: { pagos: true, cargos: true },
    });
  }

  // ─── Cancelar CFDI ────────────────────────────────────────
  async cancelCfdi(facturaId: string, motivo: string, actorId: string, sedeId: string, ip: string) {
    const factura = await this.prisma.factura.findFirst({
      where: { id: facturaId, sedeId },
      include: { sede: true },
    });
    if (!factura?.cfdiUuid) throw new BadRequestException('No hay CFDI timbrado para cancelar');

    // Cancelar ante el SAT vía PAC
    await this.pac.cancelarComprobante(factura.sede, factura.cfdiUuid, motivo);

    const updated = await this.prisma.factura.update({
      where: { id: facturaId },
      data: { estadoCfdi: EstadoCFDI.CANCELADO, actorId },
    });

    await this.audit.log({
      actorId, sedeId, ip,
      accion: 'CANCEL_CFDI',
      recursoTipo: 'factura',
      recursoId: facturaId,
      datosNuevos: { motivo, cfdiUuid: factura.cfdiUuid },
    });

    return updated;
  }

  // ─── Exportación contable (puente para QB) ────────────────
  async exportAccounting(sedeId: string, desde: Date, hasta: Date, formato: 'xlsx' | 'csv_qbo' | 'zip') {
    const facturas = await this.prisma.factura.findMany({
      where: {
        sedeId,
        estadoCfdi: EstadoCFDI.TIMBRADO,
        fechaTimbrado: { gte: desde, lte: hasta },
      },
      include: { cargos: true, pagos: true, paciente: true },
      orderBy: { fechaTimbrado: 'asc' },
    });

    if (formato === 'csv_qbo') {
      return this.buildQboCsv(facturas);
    } else if (formato === 'zip') {
      return this.buildCfdiZip(facturas, sedeId);
    } else {
      return this.buildAccountingExcel(facturas);
    }
  }

  // ─── Listar facturas ──────────────────────────────────────
  async findAll(opts: {
    sedeId: string; desde?: string; hasta?: string;
    estado?: string; page: number; limit: number;
  }) {
    const { sedeId, desde, hasta, estado, page, limit } = opts;
    const skip = (page - 1) * limit;
    const where: any = { sedeId };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) {
        const h = new Date(hasta);
        h.setHours(23, 59, 59, 999);
        where.createdAt.lte = h;
      }
    }
    if (estado) where.estadoCfdi = estado as EstadoCFDI;

    const [total, facturas] = await Promise.all([
      this.prisma.factura.count({ where }),
      this.prisma.factura.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          paciente: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } },
          cargos: { select: { concepto: true, total: true } },
        },
      }),
    ]);
    return this.prisma.paginate(facturas, total, page, limit);
  }

  // ─── Obtener factura por ID ────────────────────────────────
  async findById(facturaId: string, sedeId: string) {
    const f = await this.prisma.factura.findFirst({
      where: { id: facturaId, sedeId },
      include: {
        paciente: true,
        cargos: { include: { servicio: true } },
        pagos: { orderBy: { createdAt: 'desc' } },
        sede: { select: { nombre: true, rfc: true, razonSocial: true } },
      },
    });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }

  // ─── Historial de cortes de caja ──────────────────────────
  async getCashRegisterHistory(sedeId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;
    const [total, cortes] = await Promise.all([
      this.prisma.cortesCaja.count({ where: { sedeId } }),
      this.prisma.cortesCaja.findMany({
        where: { sedeId },
        skip,
        take: limit,
        orderBy: { fechaFin: 'desc' },
      }),
    ]);
    return this.prisma.paginate(cortes, total, page, limit);
  }

  // ─── Corte de caja ────────────────────────────────────────
  async closeCashRegister(sedeId: string, usuarioId: string, turno: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pagos = await this.prisma.pago.findMany({
      where: {
        factura: { sedeId },
        createdAt: { gte: hoy, lt: manana },
      },
    });

    const totales = pagos.reduce(
      (acc, p) => {
        const monto = Number(p.monto);
        switch (p.metodoPago) {
          case 'EFECTIVO': acc.efectivo += monto; break;
          case 'TARJETA_CREDITO':
          case 'TARJETA_DEBITO': acc.tarjeta += monto; break;
          case 'TRANSFERENCIA': acc.transf += monto; break;
          default: acc.otros += monto;
        }
        acc.total += monto;
        return acc;
      },
      { efectivo: 0, tarjeta: 0, transf: 0, otros: 0, total: 0 },
    );

    return this.prisma.cortesCaja.create({
      data: {
        sedeId,
        usuarioId,
        turno,
        fechaInicio: hoy,
        fechaFin: new Date(),
        totalEfectivo: totales.efectivo,
        totalTarjeta: totales.tarjeta,
        totalTransf: totales.transf,
        totalOtros: totales.otros,
        totalGeneral: totales.total,
      },
    });
  }

  // ─── Helpers privados ────────────────────────────────────
  private async preloadConsultationCharges(facturaId: string, consultaId: string, sedeId: string) {
    const consulta = await this.prisma.consulta.findUnique({
      where: { id: consultaId },
      include: { cita: true, ordenes: true },
    });
    if (!consulta) return;

    const servicioConsulta = await this.prisma.servicioCatalogo.findFirst({
      where: { clave: `CONSULTA_${consulta.cita.tipoCita}`, activo: true },
    });

    if (servicioConsulta) {
      await this.prisma.cargo.create({
        data: {
          facturaId,
          servicioId: servicioConsulta.id,
          concepto: servicioConsulta.nombre,
          claveSAT: servicioConsulta.claveSAT,
          claveUnidadSAT: servicioConsulta.claveUnidadSAT,
          precioUnitario: servicioConsulta.precio,
          cantidad: 1,
          descuento: 0,
          subtotal: servicioConsulta.precio,
          ivaAplicable: servicioConsulta.ivaAplicable,
          tasaIva: servicioConsulta.tasaIva,
          iva: servicioConsulta.ivaAplicable ? Number(servicioConsulta.precio) * Number(servicioConsulta.tasaIva) : 0,
          total: servicioConsulta.precio,
        },
      });
    }
  }

  private async recalcTotals(facturaId: string) {
    const cargos = await this.prisma.cargo.findMany({ where: { facturaId } });
    const subtotal = cargos.reduce((s, c) => s + Number(c.subtotal), 0);
    const iva = cargos.reduce((s, c) => s + Number(c.iva), 0);
    const total = subtotal + iva;

    return this.prisma.factura.update({
      where: { id: facturaId },
      data: { subtotal, iva, total, saldo: total },
      include: { cargos: true },
    });
  }

  private buildCfdi40(factura: any): string {
    // Construcción del XML CFDI 4.0 según estructura del SAT
    const fecha = new Date().toISOString().substring(0, 19);
    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 cfdv40.xsd"
  Version="4.0"
  Fecha="${fecha}"
  Sello=""
  FormaPago="${this.getFormaPagoSAT(factura)}"
  NoCertificado=""
  Certificado=""
  SubTotal="${Number(factura.subtotal).toFixed(2)}"
  Descuento="${Number(factura.cargos.reduce((s: number, c: any) => s + Number(c.descuento), 0)).toFixed(2)}"
  Moneda="MXN"
  Total="${Number(factura.total).toFixed(2)}"
  TipoDeComprobante="I"
  Exportacion="01"
  MetodoPago="PUE"
  LugarExpedicion="${factura.sede.rfc}">
  <cfdi:Emisor
    Rfc="${factura.sede.rfc}"
    Nombre="${factura.sede.razonSocial}"
    RegimenFiscal="612"/>
  <cfdi:Receptor
    Rfc="${factura.rfcReceptor ?? 'XAXX010101000'}"
    Nombre="${factura.razonSocialReceptor ?? 'PUBLICO EN GENERAL'}"
    DomicilioFiscalReceptor="${factura.paciente?.direccion?.codigoPostal ?? '00000'}"
    RegimenFiscalReceptor="${factura.regimenFiscalReceptor ?? '616'}"
    UsoCFDI="${factura.usoCfdi ?? 'G03'}"/>
  <cfdi:Conceptos>
    ${factura.cargos.map((c: any) => `
    <cfdi:Concepto
      ClaveProdServ="${c.claveSAT}"
      Cantidad="${Number(c.cantidad).toFixed(3)}"
      ClaveUnidad="${c.claveUnidadSAT}"
      Descripcion="${c.concepto}"
      ValorUnitario="${Number(c.precioUnitario).toFixed(2)}"
      Importe="${Number(c.subtotal).toFixed(2)}"
      Descuento="${Number(c.descuento).toFixed(2)}"
      ObjetoImp="${c.ivaAplicable ? '02' : '01'}">
      ${c.ivaAplicable ? `<cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="${Number(c.subtotal).toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${Number(c.tasaIva).toFixed(6)}" Importe="${Number(c.iva).toFixed(2)}"/></cfdi:Traslados></cfdi:Impuestos>` : ''}
    </cfdi:Concepto>`).join('')}
  </cfdi:Conceptos>
  ${Number(factura.iva) > 0 ? `
  <cfdi:Impuestos TotalImpuestosTrasladados="${Number(factura.iva).toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${Number(factura.subtotal).toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${Number(factura.iva).toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>` : ''}
</cfdi:Comprobante>`;
  }

  private getFormaPagoSAT(factura: any): string {
    const mapa: Record<string, string> = {
      EFECTIVO: '01', CHEQUE: '02', TRANSFERENCIA: '03',
      TARJETA_CREDITO: '04', TARJETA_DEBITO: '28', CREDITO_INTERNO: '99',
    };
    return mapa[factura.metodoPagoSAT?.[0]] ?? '01';
  }

  private async generateFacturaPdf(factura: any, uuid: string): Promise<Buffer> {
    // Generar PDF de representación impresa del CFDI
    // Implementación real usaría pdfkit con el diseño de la clínica
    return Buffer.from(`PDF CFDI ${uuid}`);
  }

  private async generatePaymentComplement(facturaId: string, dto: RegisterPaymentDto) {
    // Generar CFDI de Complemento de Pago (P)
    this.logger.log(`Generando complemento de pago para factura ${facturaId}`);
    // Implementación completa según estructura SAT para CP
  }

  private buildQboCsv(facturas: any[]): string {
    const headers = '*InvoiceNo,*Customer,*InvoiceDate,*DueDate,Terms,Location,Memo,*ItemName,ItemDescription,*ItemQuantity,*ItemRate,ItemTaxCode,ItemTaxAmount';
    const rows = facturas.flatMap(f =>
      f.cargos.map((c: any) =>
        `${f.cfdiUuid},${f.rfcReceptor ?? 'PUBLICO_GENERAL'},${f.fechaTimbrado?.toISOString().substring(0, 10)},${f.fechaTimbrado?.toISOString().substring(0, 10)},Net30,,${f.cfdiUuid},${c.concepto},,${c.cantidad},${c.precioUnitario},${c.ivaAplicable ? 'IVA16' : 'EXENTO'},${c.iva}`,
      ),
    );
    return [headers, ...rows].join('\n');
  }

  private async buildCfdiZip(facturas: any[], sedeId: string): Promise<Buffer> {
    // Empaqueta XMLs de los CFDIs para descarga
    return Buffer.from('ZIP_PLACEHOLDER');
  }

  private buildAccountingExcel(facturas: any[]): any[] {
    return facturas.map(f => ({
      fecha: f.fechaTimbrado,
      folioInterno: f.numeroFacturaInterno,
      uuid: f.cfdiUuid,
      rfcReceptor: f.rfcReceptor,
      razonSocial: f.razonSocialReceptor,
      subtotal: f.subtotal,
      iva: f.iva,
      total: f.total,
      montoPagado: f.montoPagado,
      saldo: f.saldo,
      estado: f.estadoPago,
      metodoPago: f.pagos[0]?.metodoPago,
    }));
  }
}
