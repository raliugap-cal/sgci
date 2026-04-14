// ═══════════════════════════════════════════════════════════
// AUDIT SERVICE — Registro inmutable NOM-004 + NOM-024
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface AuditEntry {
  actorId?: string;
  actorRol?: string;
  actorEmail?: string;
  sedeId?: string;
  ip?: string;
  userAgent?: string;
  accion: string;
  recursoTipo: string;
  recursoId?: string;
  datosPrevios?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  esOfflineSync?: boolean;
  deviceId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditoria.create({ data: entry });
    } catch (e) {
      // La auditoría nunca debe bloquear la operación principal
      this.logger.error(`Error guardando auditoría: ${e.message}`, { entry });
    }
  }

  async getAuditTrail(recursoTipo: string, recursoId: string, limit = 50) {
    return this.prisma.auditoria.findMany({
      where: { recursoTipo, recursoId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// ═══════════════════════════════════════════════════════════
// RENAPO SERVICE — Validación CURP (no bloqueante)
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger as RLogger } from '@nestjs/common';
import { ConfigService as RConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RenapoService {
  private readonly logger = new RLogger(RenapoService.name);

  constructor(private config: RConfigService) {}

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
        datos: valida ? { nombre: data?.nombre, paterno: data?.apellido1, materno: data?.apellido2 } : null,
        mensaje: valida ? undefined : `CURP ${data?.estadoCurp ?? 'no encontrada'}`,
      };
    } catch (e) {
      this.logger.warn(`RENAPO no disponible: ${e.message}`);
      return { valida: false, mensaje: `RENAPO no disponible: ${e.message}` };
    }
  }
}

// ═══════════════════════════════════════════════════════════
// GENERADORES — Números de expediente, factura, receta
// ═══════════════════════════════════════════════════════════

export function generateExpedienteNumber(sedeId: string, lastExpediente?: string | null): string {
  // Formato: SGCI-{SEDE_PREFIX}-{YEAR}-{SEQUENCE_5}
  // Ejemplo: SGCI-MTY-2024-00001
  const sedePrefix = sedeId.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear();

  let seq = 1;
  if (lastExpediente) {
    const match = lastExpediente.match(/(\d{5})$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `SGCI-${sedePrefix}-${year}-${String(seq).padStart(5, '0')}`;
}

export async function generateFacturaNumber(prisma: any, sedeId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  const count = await prisma.factura.count({
    where: { sedeId, createdAt: { gte: new Date(`${year}-${month}-01`) } },
  });

  // Formato: FAC-{YEAR}{MONTH}-{SEQ}
  return `FAC-${year}${month}-${String(count + 1).padStart(5, '0')}`;
}

export function generateRecetaNumber(tipoReceta: string): string {
  const prefix = tipoReceta === 'ESTUPEFACIENTE' ? 'RCE' : tipoReceta === 'ESPECIAL' ? 'RCX' : 'RCO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateBarCode(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LAB${timestamp}${random}`;
}
