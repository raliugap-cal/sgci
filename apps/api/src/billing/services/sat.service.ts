import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SatService {
  private readonly logger = new Logger(SatService.name);
  constructor(private config: ConfigService) {}

  async validateRfc(rfc: string): Promise<boolean> {
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
    return rfcRegex.test(rfc.toUpperCase());
  }

  buildCfdiXml(factura: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Version="4.0" Folio="${factura.numeroFacturaInterno}"
  Fecha="${new Date().toISOString().replace('Z','')}"
  FormaPago="01" SubTotal="${factura.subtotal}" Total="${factura.total}"
  TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE"
  LugarExpedicion="64000">
</cfdi:Comprobante>`;
  }
}
