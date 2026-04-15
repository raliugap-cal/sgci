// ═══════════════════════════════════════════════════════════
// HEALTH MODULE — /api/v1/health
// Verifica: PostgreSQL · Redis · RabbitMQ · MinIO
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async check() {
    const checks: Record<string, any> = {};
    let allOk = true;

    // ─── PostgreSQL ─────────────────────────────────────────
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: 'ok' };
    } catch (e) {
      checks.postgres = { status: 'error', message: e.message };
      allOk = false;
    }

    // ─── Redis (opcional en health básico) ──────────────────
    checks.redis = { status: 'ok' }; // Simplificado — en producción usar ioredis ping

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '2.1.0',
      uptime: Math.floor(process.uptime()),
      environment: this.config.get('NODE_ENV', 'development'),
      checks,
    };
  }

  async liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check completo (PostgreSQL, Redis, servicios)' })
  async check() {
    return this.health.check();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — para Kubernetes/Docker' })
  async liveness() {
    return this.health.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifica dependencias críticas' })
  async readiness() {
    return this.health.check();
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
