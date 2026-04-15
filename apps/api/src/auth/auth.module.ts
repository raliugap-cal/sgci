// ═══════════════════════════════════════════════════════════
// MODULE WRAPPERS — Auth · Patients · Notifications · Sync
// ═══════════════════════════════════════════════════════════

// ─── auth.module.ts ──────────────────────────────────────
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy, LocalStrategy } from './strategies/jwt.strategy';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthController } from './patient-auth.service';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30m', issuer: 'sgci', audience: 'sgci-staff' },
      }),
    }),
  ],
  controllers: [AuthController, PatientAuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, PatientAuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
