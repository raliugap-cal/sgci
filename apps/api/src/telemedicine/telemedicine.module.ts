// ═══════════════════════════════════════════════════════════
// TELEMEDICINE MODULE — Daily.co WebRTC
// Crear salas · Tokens médico/paciente · Sesión grabada
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId } from '../auth/strategies/jwt.strategy';
import { Rol } from '@prisma/client';

interface CreateRoomOptions {
  citaId: string;
  pacienteId: string;
  medicoId: string;
  fechaInicio: Date;
  duracionMinutos: number;
}

@Injectable()
export class TelemedicineService {
  private readonly logger = new Logger(TelemedicineService.name);
  private readonly DAILY_API_BASE = 'https://api.daily.co/v1';
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('DAILY_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('⚠️ DAILY_API_KEY no configurada — telemedicina en modo simulado');
    }
  }

  // ─── Crear sala Daily.co ────────────────────────────────
  async createRoom(opts: CreateRoomOptions): Promise<{ url: string; name: string; medicoToken: string }> {
    const roomName = `sgci-${opts.citaId.substring(0, 8)}-${Date.now()}`;
    const expiryTimestamp = Math.floor(opts.fechaInicio.getTime() / 1000) + (opts.duracionMinutos * 60) + 900; // +15 min extra

    if (!this.apiKey) {
      // Modo simulado para desarrollo
      return {
        url: `https://demo.daily.co/${roomName}`,
        name: roomName,
        medicoToken: `dev-token-medico-${roomName}`,
      };
    }

    try {
      // 1. Crear sala
      const { data: room } = await axios.post(
        `${this.DAILY_API_BASE}/rooms`,
        {
          name: roomName,
          privacy: 'private', // Solo acceso con token
          properties: {
            exp: expiryTimestamp,
            max_participants: 4, // Médico + paciente + familiar + observador
            enable_recording: 'cloud',
            recording_bucket_name: this.config.get('DAILY_RECORDING_BUCKET', ''),
            enable_chat: true,
            enable_knocking: true,
            start_video_off: false,
            start_audio_off: false,
            geo: 'latam', // Servidores de baja latencia en LATAM
            owner_only_broadcast: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // 2. Generar token del médico (owner con permisos completos)
      const medicoToken = await this.generateToken(roomName, opts.medicoId, true, expiryTimestamp);

      return { url: room.url, name: roomName, medicoToken };
    } catch (e) {
      this.logger.error(`Error creando sala Daily.co: ${e.response?.data?.info ?? e.message}`);
      throw new BadRequestException(`No se pudo crear la sala de videoconsulta: ${e.response?.data?.info ?? e.message}`);
    }
  }

  // ─── Token para el paciente ──────────────────────────────
  async generatePatientToken(roomName: string, pacienteId: string): Promise<string> {
    if (!this.apiKey) return `dev-token-paciente-${roomName}`;

    const expiryTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 horas desde ahora
    return this.generateToken(roomName, pacienteId, false, expiryTimestamp);
  }

  // ─── Obtener detalles de la sala ─────────────────────────
  async getRoomDetails(roomName: string): Promise<any> {
    if (!this.apiKey) return { name: roomName, url: `https://demo.daily.co/${roomName}` };

    const { data } = await axios.get(`${this.DAILY_API_BASE}/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return data;
  }

  // ─── Eliminar sala al completar sesión ───────────────────
  async deleteRoom(roomName: string): Promise<void> {
    if (!this.apiKey) return;

    try {
      await axios.delete(`${this.DAILY_API_BASE}/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    } catch (e) {
      this.logger.warn(`No se pudo eliminar sala ${roomName}: ${e.message}`);
    }
  }

  // ─── Helper: generar meeting token ───────────────────────
  private async generateToken(
    roomName: string,
    userId: string,
    isOwner: boolean,
    expiryTimestamp: number,
  ): Promise<string> {
    const { data } = await axios.post(
      `${this.DAILY_API_BASE}/meeting-tokens`,
      {
        properties: {
          room_name: roomName,
          user_id: userId,
          is_owner: isOwner,
          exp: expiryTimestamp,
          enable_screenshare: isOwner,
          start_cloud_recording: isOwner,
          lang: 'es',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return data.token;
  }
}

// ─── Controller ──────────────────────────────────────────
@ApiTags('telemedicine')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telemedicine')
export class TelemedicineController {
  constructor(private svc: TelemedicineService) {}

  @Get('rooms/:roomName')
  @Roles(Rol.MEDICO, Rol.SUPERADMIN, Rol.ADMIN_SEDE)
  @ApiOperation({ summary: 'Obtener detalles de una sala de videoconsulta' })
  async getRoomDetails(@Param('roomName') roomName: string) {
    return this.svc.getRoomDetails(roomName);
  }
}

// ─── Module ──────────────────────────────────────────────
@Module({
  controllers: [TelemedicineController],
  providers: [TelemedicineService],
  exports: [TelemedicineService],
})
export class TelemedicineModule {}
