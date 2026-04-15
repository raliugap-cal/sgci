import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { HceModule } from './hce/hce.module';
import { AddictionsModule } from './addictions/addictions.module';
import { LabModule } from './lab/lab.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { FilesModule } from './files/files.module';
import { TelemedicineModule } from './telemedicine/telemedicine.module';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ─── Configuración global ──────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ─── Rate limiting ─────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: config.get<number>('RATE_LIMIT_SHORT', 20),
          },
          {
            name: 'medium',
            ttl: 60000,
            limit: config.get<number>('RATE_LIMIT_MEDIUM', 300),
          },
          {
            name: 'long',
            ttl: 3600000,
            limit: config.get<number>('RATE_LIMIT_LONG', 5000),
          },
        ],
      }),
    }),

    // ─── Tareas programadas (recordatorios, sync QB, etc.) ─
    ScheduleModule.forRoot(),

    // ─── Core ─────────────────────────────────────────────
    PrismaModule,
    FilesModule,
    NotificationsModule,

    // ─── Dominio ──────────────────────────────────────────
    AuthModule,
    PatientsModule,
    AppointmentsModule,
    HceModule,
    AddictionsModule,
    LabModule,
    PrescriptionsModule,
    BillingModule,
    TelemedicineModule,
    SyncModule,

    // ─── Soporte ──────────────────────────────────────────
    ReportsModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
