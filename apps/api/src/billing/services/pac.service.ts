import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PacService {
  private readonly logger = new Logger(PacService.name);

  constructor(private config: ConfigService) {}

  async timbraComprobante(xmlSinTimbre: string, pacUrl?: string, pacUser?: string, pacPass?: string): Promise<{
    uuid: string; xmlTimbrado: string; fechaTimbrado: Date;
  }> {
    const url  = pacUrl  ?? this.config.get('PAC_URL');
    const user = pacUser ?? this.config.get('PAC_USER');
    const pass = pacPass ?? this.config.get('PAC_PASS');

    if (!url || !user || !pass) {
      this.logger.warn('PAC no configurado — modo simulación');
      return {
        uuid: `SIM-${Date.now()}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
        xmlTimbrado: xmlSinTimbre.replace('</cfdi:Comprobante>', '<cfdi:Complemento><tfd:TimbreFiscalDigital/></cfdi:Complemento></cfdi:Comprobante>'),
        fechaTimbrado: new Date(),
      };
    }

    try {
      const { data } = await axios.post(`${url}/timbrar`, { xml: xmlSinTimbre }, {
        auth: { username: user, password: pass },
        timeout: 30000,
      });
      return { uuid: data.uuid, xmlTimbrado: data.xml, fechaTimbrado: new Date(data.fechaTimbrado) };
    } catch (e: any) {
      this.logger.error('Error al timbrar con PAC:', e.message);
      throw new InternalServerErrorException(`Error al timbrar CFDI: ${e.response?.data?.mensaje ?? e.message}`);
    }
  }

  async cancelarComprobante(uuid: string, rfc: string, motivo: string): Promise<void> {
    this.logger.log(`Cancelando CFDI ${uuid} — motivo: ${motivo}`);
  }
}
