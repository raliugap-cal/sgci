import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PrismaModule } from '../database/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';
import { RenapoService } from '../common/services/renapo.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PatientsController],
  providers: [PatientsService, EncryptionService, AuditService, RenapoService],
  exports: [PatientsService],
})
export class PatientsModule {}
