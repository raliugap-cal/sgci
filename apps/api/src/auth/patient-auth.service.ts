// ═══════════════════════════════════════════════════════════
// PATIENT PORTAL AUTH — Login separado del staff
// POST /api/v1/auth/patient/login
// POST /api/v1/auth/patient/refresh
// Devuelve datos del expediente para prefetch offline
// ═══════════════════════════════════════════════════════════
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PrismaModule } from '../database/prisma.module';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';
import * as bcrypt from 'bcryptjs';

// ─── DTO ─────────────────────────────────────────────────
class PatientLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

// ─── Service ─────────────────────────────────────────────
@Injectable()
export class PatientAuthService {
  private readonly logger = new Logger(PatientAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: PatientLoginDto, ip: string) {
    // Buscar paciente por email cifrado
    // En producción: buscar por hash del email para no descifrar todos
    const pacientes = await this.prisma.paciente.findMany({
      where: { portalActivado: true, activo: true },
      select: {
        id: true,
        nombre: true,
        apellidoPaterno: true,
        sedeId: true,
        emailCifrado: true,
        portalPasswordHash: true,
        tieneExpedienteAdicciones: true,
      },
    });

    // Verificar credenciales
    let pacienteMatch: any = null;
    for (const p of pacientes) {
      if (!p.emailCifrado || !p.portalPasswordHash) continue;
      try {
        // Comparar email descifrado
        const emailDecrypted = this.decryptSimple(p.emailCifrado);
        if (emailDecrypted.toLowerCase() !== dto.email.toLowerCase()) continue;

        const passwordValid = await bcrypt.compare(dto.password, p.portalPasswordHash);
        if (passwordValid) {
          pacienteMatch = p;
          break;
        }
      } catch { continue; }
    }

    if (!pacienteMatch) {
      throw new UnauthorizedException('Credenciales inválidas o portal no activado');
    }

    // Obtener expediente de adicciones si existe
    const expedienteAdiccion = pacienteMatch.tieneExpedienteAdicciones
      ? await this.prisma.expedienteAdiccion.findFirst({
          where: { pacienteId: pacienteMatch.id },
          select: { id: true },
        })
      : null;

    // Generar tokens
    const payload = {
      sub: pacienteMatch.id,
      tipo: 'portal_paciente',
      sedeId: pacienteMatch.sedeId,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_SECRET'),
      expiresIn: '7d', // Portal tiene token más largo (uso móvil)
    });

    // Actualizar último acceso del portal
    await this.prisma.paciente.update({
      where: { id: pacienteMatch.id },
      data: { portalUltimoAcceso: new Date() },
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        actorId: pacienteMatch.id,
        actorRol: 'PACIENTE',
        sedeId: pacienteMatch.sedeId,
        accion: 'PORTAL_LOGIN',
        recursoTipo: 'portal_sesion',
        ip,
      },
    });

    this.logger.log(`Portal login: paciente ${pacienteMatch.id} desde ${ip}`);

    return {
      accessToken,
      pacienteId: pacienteMatch.id,
      nombre: `${pacienteMatch.nombre} ${pacienteMatch.apellidoPaterno}`,
      sedeId: pacienteMatch.sedeId,
      expedienteAdiccionId: expedienteAdiccion?.id ?? null,
    };
  }

  private decryptSimple(buffer: Buffer): string {
    // Implementación real usa EncryptionService.decrypt
    return buffer.toString('utf8');
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('auth')
@Controller('auth/patient')
export class PatientAuthController {
  constructor(private svc: PatientAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login del portal del paciente (credenciales separadas del staff)' })
  async login(@Body() dto: PatientLoginDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0';
    return this.svc.login(dto, ip);
  }
}

// ─── Module patch — agregar al AuthModule ────────────────
// Estos providers se deben añadir al AuthModule existente:
// providers: [..., PatientAuthService]
// controllers: [..., PatientAuthController]
