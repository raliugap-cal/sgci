// ═══════════════════════════════════════════════════════════
// SEDES MODULE — SGCI
// ═══════════════════════════════════════════════════════════
import { Module } from '@nestjs/common';
import { SedesController } from './sedes.controller';
import { SedesService } from './sedes.service';
import { AuditService } from '../common/services/audit.service';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SedesController],
  providers: [SedesService, AuditService],
  exports: [SedesService],
})
export class SedesModule {}
