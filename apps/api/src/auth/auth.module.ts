// ═══════════════════════════════════════════════════════════
// AUTH MODULE
// ═══════════════════════════════════════════════════════════
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PatientAuthService, PatientAuthController } from './patient-auth.service';
import { PrismaModule } from '../database/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController, PatientAuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, PatientAuthService, EncryptionService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
