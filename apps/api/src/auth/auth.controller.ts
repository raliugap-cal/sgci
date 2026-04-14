// ═══════════════════════════════════════════════════════════
// AUTH CONTROLLER
// POST /api/v1/auth/login
// POST /api/v1/auth/verify-mfa
// POST /api/v1/auth/refresh
// POST /api/v1/auth/logout
// GET  /api/v1/auth/setup-mfa
// POST /api/v1/auth/confirm-mfa
// POST /api/v1/auth/switch-sede
// GET  /api/v1/auth/me
// ═══════════════════════════════════════════════════════════
import {
  Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard, CurrentUser, ClientIp } from './strategies/jwt.strategy';
import { IsEmail, IsString, MinLength, IsOptional, Length } from 'class-validator';

// ─── DTOs inline ─────────────────────────────────────────
class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

class VerifyMfaDto {
  @IsString() @Length(6, 6) code: string;
  @IsString() mfaToken: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

class ConfirmMfaDto {
  @IsString() @Length(6, 6) code: string;
}

class SwitchSedeDto {
  @IsString() sedeId: string;
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // Max 5 intentos/minuto
  @ApiOperation({ summary: 'Login con email y contraseña' })
  async login(@Body() dto: LoginDto, @Req() req: any, @ClientIp() ip: string) {
    const usuario = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(usuario, ip, req.headers['user-agent'] ?? '');
  }

  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verificar código TOTP de MFA' })
  async verifyMfa(@Body() dto: VerifyMfaDto, @Req() req: any, @ClientIp() ip: string) {
    // Decodificar mfaToken para extraer userId
    const payload = this.authService.decodeMfaToken(dto.mfaToken);
    return this.authService.verifyMfa(payload.sub, dto.code, ip, req.headers['user-agent'] ?? '');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token con refresh token' })
  async refresh(@Body() dto: RefreshDto, @Req() req: any, @ClientIp() ip: string) {
    return this.authService.refreshToken(dto.refreshToken, ip, req.headers['user-agent'] ?? '');
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh token' })
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('setup-mfa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Iniciar configuración de MFA — retorna QR' })
  async setupMfa(@CurrentUser() user: any) {
    return this.authService.setupMfa(user.userId);
  }

  @Post('confirm-mfa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar MFA con primer código y activar' })
  async confirmMfa(@CurrentUser() user: any, @Body() dto: ConfirmMfaDto) {
    return this.authService.confirmMfa(user.userId, dto.code);
  }

  @Post('switch-sede')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar sede activa (devuelve nuevo access token)' })
  async switchSede(@CurrentUser() user: any, @Body() dto: SwitchSedeDto) {
    return this.authService.switchSede(user.userId, dto.sedeId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  async me(@CurrentUser() user: any) {
    return user;
  }
}
