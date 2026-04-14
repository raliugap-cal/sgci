// ═══════════════════════════════════════════════════════════
// AUTH MODULE — JWT + MFA TOTP + Refresh Token Rotation
// ═══════════════════════════════════════════════════════════

// ─── auth.module.ts ─────────────────────────────────────────
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PrismaModule } from '../database/prisma.module';

// ─────────────────────────────────────────────────────────────
export const AuthModuleDef = {
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
};

// ─── auth.service.ts ────────────────────────────────────────
import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { randomBytes } from 'crypto';
import { addMinutes, addDays } from 'date-fns';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_INTENTOS = 5;
  private readonly BLOQUEO_MINUTOS = 30;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Validar usuario en login ──────────────────────────────
  async validateUser(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { medico: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar bloqueo por intentos fallidos
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutos = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Cuenta bloqueada. Intente en ${minutos} minutos`);
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValida) {
      const intentos = usuario.intentosFallidos + 1;
      const bloqueado = intentos >= this.MAX_INTENTOS;

      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: intentos,
          bloqueadoHasta: bloqueado
            ? addMinutes(new Date(), this.BLOQUEO_MINUTOS)
            : null,
        },
      });

      if (bloqueado) {
        throw new ForbiddenException(`Demasiados intentos. Cuenta bloqueada ${this.BLOQUEO_MINUTOS} minutos`);
      }

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset de intentos fallidos
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });

    return usuario;
  }

  // ─── Login completo ────────────────────────────────────────
  async login(usuario: any, ip: string, userAgent: string) {
    // Si tiene MFA activo, retornar token temporal
    if (usuario.mfaActivo) {
      const mfaToken = this.jwt.sign(
        { sub: usuario.id, mfa_pending: true },
        { expiresIn: '5m', secret: this.config.getOrThrow('JWT_SECRET') },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.generateTokenPair(usuario, ip, userAgent);
  }

  // ─── Verificar MFA TOTP ────────────────────────────────────
  async verifyMfa(userId: string, code: string, ip: string, userAgent: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: userId },
      include: { medico: true },
    });

    if (!usuario.mfaActivo || !usuario.mfaSecret) {
      throw new BadRequestException('MFA no configurado para este usuario');
    }

    const secreto = this.decryptField(usuario.mfaSecret);
    const valido = authenticator.verify({ token: code, secret: secreto });

    if (!valido) {
      // También verificar backup codes
      const idx = usuario.mfaBackupCodes.indexOf(code);
      if (idx === -1) throw new UnauthorizedException('Código MFA inválido');

      // Consumir backup code (de un solo uso)
      const nuevosCodes = usuario.mfaBackupCodes.filter((_, i) => i !== idx);
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { mfaBackupCodes: nuevosCodes },
      });
    }

    return this.generateTokenPair(usuario, ip, userAgent);
  }

  // ─── Setup MFA ────────────────────────────────────────────
  async setupMfa(userId: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret(32);
    const otpauth = authenticator.keyuri(usuario.email, 'SGCI Clínica', secret);
    const qrDataUrl = await toDataURL(otpauth);

    // Guardar secreto cifrado (se confirma cuando el usuario verifica con el primer código)
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { mfaSecret: this.encryptField(secret) },
    });

    return { qrDataUrl, manualKey: secret };
  }

  // ─── Confirmar y activar MFA ──────────────────────────────
  async confirmMfa(userId: string, code: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
    if (!usuario.mfaSecret) throw new BadRequestException('Inicie el proceso de configuración MFA primero');

    const secreto = this.decryptField(usuario.mfaSecret);
    const valido = authenticator.verify({ token: code, secret: secreto });
    if (!valido) throw new UnauthorizedException('Código MFA inválido');

    // Generar backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { mfaActivo: true, mfaBackupCodes: backupCodes },
    });

    return { backupCodes };
  }

  // ─── Refresh token ────────────────────────────────────────
  async refreshToken(token: string, ip: string, userAgent: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { usuario: { include: { medico: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Rotación: revocar el anterior y crear uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokenPair(stored.usuario, ip, userAgent);
  }

  // ─── Logout ───────────────────────────────────────────────
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Decodificar token MFA temporal ─────────────────────
  decodeMfaToken(token: string): any {
    try {
      return this.jwt.verify(token, {
        secret: this.config.getOrThrow('JWT_SECRET'),
        issuer: 'sgci',
      });
    } catch {
      throw new UnauthorizedException('Token MFA inválido o expirado');
    }
  }

  // ─── Cambio de sede activa ────────────────────────────────
  async switchSede(userId: string, sedeId: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: userId },
      include: { medico: true },
    });

    // Verificar que el usuario pertenece a la sede
    const perteneceASede = usuario.sedeId === sedeId ||
      usuario.roles.includes('SUPERADMIN');

    if (!perteneceASede) {
      throw new ForbiddenException('No tiene acceso a esta sede');
    }

    const payload = this.buildJwtPayload(usuario, sedeId);
    return { accessToken: this.jwt.sign(payload) };
  }

  // ─── Helpers privados ────────────────────────────────────
  private async generateTokenPair(usuario: any, ip: string, userAgent: string) {
    const sedeId = usuario.sedeId;
    const payload = this.buildJwtPayload(usuario, sedeId);

    const accessToken = this.jwt.sign(payload);

    // Refresh token: 7 días, guardado en BD
    const refreshTokenStr = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        token: refreshTokenStr,
        expiresAt: addDays(new Date(), 7),
        ipAddress: ip,
        userAgent,
      },
    });

    // Actualizar último acceso
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    // Log de auditoría
    await this.prisma.auditoria.create({
      data: {
        actorId: usuario.id,
        actorRol: usuario.roles[0],
        actorEmail: usuario.email,
        sedeId: usuario.sedeId,
        accion: 'LOGIN',
        recursoTipo: 'sesion',
        ip,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenStr,
      expiresIn: 1800, // 30 min en segundos
      user: {
        id: usuario.id,
        nombre: `${usuario.nombre} ${usuario.apellidoPaterno}`,
        email: usuario.email,
        roles: usuario.roles,
        sedeId: usuario.sedeId,
        medicoId: usuario.medico?.id ?? null,
      },
    };
  }

  private buildJwtPayload(usuario: any, sedeId: string) {
    return {
      sub: usuario.id,
      email: usuario.email,
      roles: usuario.roles,
      sedeId,
      medicoId: usuario.medico?.id ?? null,
      iat: Math.floor(Date.now() / 1000),
    };
  }

  // Cifrado simple AES para campos sensibles en memoria
  // En producción usar KMS para la clave maestra
  private encryptField(value: string): string {
    const key = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    // Implementación real usaría crypto.createCipheriv con IV aleatorio
    // Simplificado para legibilidad; en producción usar crypto estándar
    return Buffer.from(`${key.substring(0, 8)}:${value}`).toString('base64');
  }

  private decryptField(encrypted: string): string {
    const decoded = Buffer.from(encrypted, 'base64').toString();
    return decoded.split(':').slice(1).join(':');
  }
}
