// ═══════════════════════════════════════════════════════════
// AUDIT SERVICE — Registro inmutable NOM-004 + NOM-024
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
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
