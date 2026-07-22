// ═══════════════════════════════════════════════════════════
// RENAPO SERVICE — Validación CURP (no bloqueante)
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RenapoService {
  private readonly logger = new Logger(RenapoService.name);

  constructor(private config: ConfigService) {}

  async validarCurp(curp: string): Promise<{ valida: boolean; datos?: any; mensaje?: string }> {
    const url = this.config.get<string>('RENAPO_URL');
    if (!url) return { valida: true, mensaje: 'RENAPO_URL no configurado — validación omitida' };

    try {
      const { data } = await axios.get(`${url}/ws/regverifcurp/${curp}`, {
        timeout: 5000,
        headers: { Accept: 'application/json' },
      });

      const valida = data?.statusOper === 'ANT' || data?.estadoCurp === 'A';
      return {
        valida,
        datos: valida
          ? { nombre: data?.nombre, paterno: data?.apellido1, materno: data?.apellido2 }
          : null,
        mensaje: valida ? undefined : `CURP ${data?.estadoCurp ?? 'no encontrada'}`,
      };
    } catch (e) {
      this.logger.warn(`RENAPO no disponible: ${e.message}`);
      return { valida: false, mensaje: `RENAPO no disponible: ${e.message}` };
    }
  }
}
