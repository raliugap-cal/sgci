import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
