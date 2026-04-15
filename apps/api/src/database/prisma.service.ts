// ─── prisma.service.ts ────────────────────────────────────────
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private config: ConfigService) {
    super({
      datasources: { db: { url: config.get<string>('DATABASE_URL') } },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Log queries en desarrollo
    if (config.get<string>('NODE_ENV') === 'development') {
      (this.$on as any)('query', (e: any) => {
        if (e.duration > 500) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query.substring(0, 200)}`);
        }
      });
    }

    (this.$on as any)('error', (e: any) => {
      this.logger.error(`DB Error: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Conectado a PostgreSQL');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // ─── Helper: contexto de auditoría ─────────────────────────
  async withAuditContext<T>(
    actorId: string,
    actorRol: string,
    sedeId: string,
    clientIp: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    // Establece variables de sesión en PostgreSQL para triggers de auditoría
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.actor_id = '${actorId}'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.actor_rol = '${actorRol}'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.sede_id = '${sedeId}'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.client_ip = '${clientIp}'`);
      return fn();
    });
  }

  // ─── Helper: paginación estandarizada ──────────────────────
  paginate<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}
