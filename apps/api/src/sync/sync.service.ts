// ═══════════════════════════════════════════════════════════
// SYNC SERVICE — Offline-first delta sync para portal y staff
// Maneja: notas offline, diario adicciones, mensajes, vitales
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/services/audit.service';

interface OfflineRecord {
  id: string;
  type: 'nota_clinica' | 'signos_vitales' | 'diario_consumo' | 'mensaje_portal' | 'nota_sesion';
  data: Record<string, any>;
  timestampLocal: string;
  deviceId: string;
}

interface StaffSyncPayload {
  lastSyncAt: string;
  deviceId: string;
  records: OfflineRecord[];
}

interface PatientSyncPayload {
  pacienteId: string;
  lastSyncAt: string;
  deviceId: string;
  diaryEntries: {
    id: string;
    expedienteAdiccionId: string;
    fecha: string;
    huboConsumo: boolean;
    sustancias?: any[];
    estadoAnimo?: number;
    nivelAnsiedad?: number;
    factoresRiesgo?: string[];
    notas?: string;
    timestampLocal: string;
  }[];
  messages: {
    id: string;
    sedeId: string;
    asunto?: string;
    contenido: string;
    timestampLocal: string;
  }[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── Sync del personal (tablets/laptops de la sede) ───────
  async syncStaff(payload: StaffSyncPayload, actorId: string, sedeId: string, ip: string) {
    const { lastSyncAt, deviceId, records } = payload;
    const lastSync = new Date(lastSyncAt);
    const results = { synced: 0, conflicts: [] as any[], errors: [] as any[] };

    // Procesar en orden cronológico por timestamp local
    const sorted = [...records].sort(
      (a, b) => new Date(a.timestampLocal).getTime() - new Date(b.timestampLocal).getTime(),
    );

    for (const record of sorted) {
      try {
        await this.processStaffRecord(record, actorId, sedeId, ip, deviceId);
        results.synced++;
      } catch (e) {
        if (e.code === 'CONFLICT') {
          results.conflicts.push({ id: record.id, type: record.type, reason: e.message });
        } else {
          results.errors.push({ id: record.id, type: record.type, error: e.message });
          this.logger.error(`Error sync record ${record.id}: ${e.message}`);
        }
      }
    }

    // Retornar cambios del servidor desde lastSync
    const serverChanges = await this.getServerChangesForStaff(sedeId, actorId, lastSync);

    this.logger.log(
      `Sync staff: ${results.synced}/${records.length} sincronizados, ${results.conflicts.length} conflictos, ${results.errors.length} errores`,
    );

    return {
      ...results,
      serverChanges,
      syncedAt: new Date().toISOString(),
    };
  }

  // ─── Sync del portal del paciente ─────────────────────────
  async syncPatient(payload: PatientSyncPayload, ip: string) {
    const { pacienteId, lastSyncAt, deviceId, diaryEntries, messages } = payload;
    const lastSync = new Date(lastSyncAt);
    const results = { synced: 0, conflicts: [] as any[], errors: [] as any[] };

    // Sincronizar entradas del diario de adicciones
    for (const entry of diaryEntries) {
      try {
        await this.syncDiaryEntry(entry, pacienteId, deviceId);
        results.synced++;
      } catch (e) {
        results.errors.push({ id: entry.id, error: e.message });
      }
    }

    // Sincronizar mensajes redactados offline
    for (const msg of messages) {
      try {
        await this.syncMessage(msg, pacienteId, deviceId);
        results.synced++;
      } catch (e) {
        results.errors.push({ id: msg.id, error: e.message });
      }
    }

    // Obtener cambios del servidor para el paciente
    const serverChanges = await this.getServerChangesForPatient(pacienteId, lastSync);

    return {
      ...results,
      serverChanges,
      syncedAt: new Date().toISOString(),
    };
  }

  // ─── Precarga inicial para portal paciente ────────────────
  async getPrefetchData(pacienteId: string) {
    const [
      citas,
      diagnosticosActivos,
      alergias,
      medicamentosActivos,
      recetas,
      resultados,
      mensajes,
      expedienteAdiccion,
    ] = await Promise.all([
      // Próximas 30 días + últimas 10
      this.prisma.cita.findMany({
        where: {
          pacienteId,
          OR: [
            { fechaInicio: { gte: new Date() } },
            { fechaInicio: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
        orderBy: { fechaInicio: 'asc' },
        take: 20,
        include: {
          medico: { include: { usuario: true } },
          sede: { select: { nombre: true, direccionFiscal: true } },
        },
      }),
      this.prisma.diagnostico.findMany({
        where: { consulta: { pacienteId }, estado: { in: ['activo', 'cronico'] } },
        include: { cie10: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.alergia.findMany({
        where: { pacienteId, activa: true },
      }),
      this.prisma.receta.findMany({
        where: { pacienteId, estado: 'ACTIVA' },
        include: { items: { include: { medicamento: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.receta.findMany({
        where: { pacienteId },
        include: { items: true, medico: { include: { usuario: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.ordenLaboratorio.findMany({
        where: { pacienteId },
        include: {
          items: { include: { estudio: true } },
          resultados: true,
        },
        orderBy: { fechaEmision: 'desc' },
        take: 10,
      }),
      this.prisma.mensajePortal.findMany({
        where: { pacienteId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Diario del mes actual si tiene expediente de adicciones
      this.prisma.diarioConsumo.findMany({
        where: {
          expediente: { pacienteId },
          fecha: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        orderBy: { fecha: 'desc' },
      }).catch(() => []),
    ]);

    return {
      citas,
      diagnosticosActivos,
      alergias,
      medicamentosActivos,
      recetas,
      resultados,
      mensajes,
      diarioMesActual: expedienteAdiccion,
      generadoAt: new Date().toISOString(),
      ttlSeconds: 300, // Cliente debe refrescar cada 5 min cuando está online
    };
  }

  // ─── Procesar registro offline del staff ─────────────────
  private async processStaffRecord(
    record: OfflineRecord,
    actorId: string,
    sedeId: string,
    ip: string,
    deviceId: string,
  ) {
    switch (record.type) {
      case 'nota_clinica':
        return this.syncNotaClinica(record, actorId, deviceId, ip);
      case 'signos_vitales':
        return this.syncSignosVitales(record, actorId, deviceId);
      case 'nota_sesion':
        return this.syncNotaSesion(record, actorId, deviceId);
      default:
        throw new Error(`Tipo de registro desconocido: ${record.type}`);
    }
  }

  private async syncNotaClinica(record: OfflineRecord, actorId: string, deviceId: string, ip: string) {
    const { consultaId, tipoNota, subjetivo, objetivo, evaluacion, plan, ...rest } = record.data;

    // Verificar conflicto: ¿alguien más editó esta nota online mientras estaba offline?
    const existing = await this.prisma.notaClinica.findFirst({
      where: { consultaId, medicoId: actorId },
    });

    if (existing?.firmada) {
      const err: any = new Error('La nota ya fue firmada online; no se puede sobrescribir');
      err.code = 'CONFLICT';
      throw err;
    }

    if (existing) {
      // Detectar conflicto de edición
      const serverUpdatedAt = existing.updatedAt;
      const localCreatedAt = new Date(record.timestampLocal);
      if (serverUpdatedAt > localCreatedAt && actorId !== existing.actorId) {
        const err: any = new Error('Conflicto: la nota fue modificada en otro dispositivo');
        err.code = 'CONFLICT';
        throw err;
      }

      // Guardar versión anterior
      await this.prisma.versionNota.create({
        data: {
          notaId: existing.id,
          version: existing.version,
          contenido: { subjetivo: existing.subjetivo, objetivo: existing.objetivo, evaluacion: existing.evaluacion, plan: existing.plan },
          actorId,
        },
      });

      // Actualizar con datos offline
      return this.prisma.notaClinica.update({
        where: { id: existing.id },
        data: {
          subjetivo: subjetivo ?? existing.subjetivo,
          objetivo: objetivo ?? existing.objetivo,
          evaluacion: evaluacion ?? existing.evaluacion,
          plan: plan ?? existing.plan,
          version: { increment: 1 },
          syncPending: false,
          creadaOffline: false,
          actorId,
          deviceId,
        },
      });
    }

    // Crear nueva nota
    return this.prisma.notaClinica.create({
      data: {
        consultaId,
        medicoId: actorId,
        tipoNota,
        subjetivo,
        objetivo,
        evaluacion,
        plan,
        syncPending: false,
        creadaOffline: true,
        deviceId,
        actorId,
      },
    });
  }

  private async syncSignosVitales(record: OfflineRecord, actorId: string, deviceId: string) {
    const { consultaId, ...vitales } = record.data;

    const existing = await this.prisma.signosVitales.findUnique({ where: { consultaId } });
    if (existing) {
      return this.prisma.signosVitales.update({
        where: { consultaId },
        data: { ...vitales, syncPending: false, creadaOffline: true },
      });
    }

    return this.prisma.signosVitales.create({
      data: {
        consultaId,
        capturadoPorId: actorId,
        ...vitales,
        syncPending: false,
        creadaOffline: true,
        deviceId,
      },
    });
  }

  private async syncNotaSesion(record: OfflineRecord, actorId: string, deviceId: string) {
    const { id: remoteId, ...data } = record.data;
    return this.prisma.notaSesion.create({
      data: { ...data, registradoPorId: actorId, syncPending: false, actorId, deviceId },
    });
  }

  private async syncDiaryEntry(entry: any, pacienteId: string, deviceId: string) {
    // Verificar que el expediente pertenece al paciente
    const expediente = await this.prisma.expedienteAdiccion.findFirst({
      where: { id: entry.expedienteAdiccionId, pacienteId },
    });
    if (!expediente) throw new BadRequestException('Expediente no pertenece al paciente');

    // Verificar duplicado por fecha
    const existing = await this.prisma.diarioConsumo.findFirst({
      where: {
        expedienteAdiccionId: entry.expedienteAdiccionId,
        fecha: new Date(entry.fecha),
      },
    });
    if (existing) {
      // Si el registro online es más reciente que el offline, no sobrescribir
      if (existing.createdAt > new Date(entry.timestampLocal)) return existing;
      return this.prisma.diarioConsumo.update({
        where: { id: existing.id },
        data: {
          huboConsumo: entry.huboConsumo,
          sustancias: entry.sustancias ?? [],
          estadoAnimo: entry.estadoAnimo,
          nivelAnsiedad: entry.nivelAnsiedad,
          factoresRiesgo: entry.factoresRiesgo ?? [],
          notas: entry.notas,
          syncPending: false,
          creadoOffline: true,
          timestampLocal: new Date(entry.timestampLocal),
        },
      });
    }

    return this.prisma.diarioConsumo.create({
      data: {
        expedienteAdiccionId: entry.expedienteAdiccionId,
        fecha: new Date(entry.fecha),
        huboConsumo: entry.huboConsumo,
        sustancias: entry.sustancias ?? [],
        estadoAnimo: entry.estadoAnimo,
        nivelAnsiedad: entry.nivelAnsiedad,
        factoresRiesgo: entry.factoresRiesgo ?? [],
        notas: entry.notas,
        syncPending: false,
        creadoOffline: true,
        timestampLocal: new Date(entry.timestampLocal),
      },
    });
  }

  private async syncMessage(msg: any, pacienteId: string, deviceId: string) {
    return this.prisma.mensajePortal.create({
      data: {
        pacienteId,
        sedeId: msg.sedeId,
        asunto: msg.asunto,
        contenido: msg.contenido,
        syncPending: false,
        creadoOffline: true,
      },
    });
  }

  private async getServerChangesForStaff(sedeId: string, actorId: string, since: Date) {
    const [citasActualizadas, expedientesActualizados] = await Promise.all([
      this.prisma.cita.findMany({
        where: { sedeId, updatedAt: { gt: since } },
        include: { paciente: true, medico: { include: { usuario: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.notaClinica.findMany({
        where: { consulta: { sedeId }, updatedAt: { gt: since } },
        select: { id: true, consultaId: true, updatedAt: true, firmada: true },
        orderBy: { updatedAt: 'asc' },
      }),
    ]);
    return { citasActualizadas, expedientesActualizados };
  }

  private async getServerChangesForPatient(pacienteId: string, since: Date) {
    const [citas, resultados, recetas, mensajes] = await Promise.all([
      this.prisma.cita.findMany({
        where: { pacienteId, updatedAt: { gt: since } },
        include: { medico: { include: { usuario: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.ordenLaboratorio.findMany({
        where: { pacienteId, updatedAt: { gt: since } },
        include: { resultados: true, items: { include: { estudio: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.receta.findMany({
        where: { pacienteId, updatedAt: { gt: since } },
        include: { items: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.mensajePortal.findMany({
        where: { pacienteId, createdAt: { gt: since } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { citas, resultados, recetas, mensajes };
  }
}
