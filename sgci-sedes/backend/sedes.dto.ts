// ═══════════════════════════════════════════════════════════
// SEDES DTOs — SGCI
// ═══════════════════════════════════════════════════════════
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Crear Sede ───────────────────────────────────────────
export class CreateSedeDto {
  @ApiProperty({ example: 'Clínica Norte', description: 'Nombre único de la sede' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX' })
  @IsString()
  @MinLength(10)
  domicilio: string;

  @ApiPropertyOptional({ example: '5512345678' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: 'contacto@clinica-norte.mx' })
  @IsOptional()
  @IsEmail()
  emailSede?: string;

  @ApiPropertyOptional({ example: '12345/2024' })
  @IsOptional()
  @IsString()
  licenciaSanitaria?: string;

  @ApiPropertyOptional({ example: 'https://storage/logos/norte.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;

  // ── Datos del admin que se creará automáticamente ────────
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  nombreAdmin: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @MinLength(2)
  apellidoPaternoAdmin: string;

  @ApiPropertyOptional({ example: 'López' })
  @IsOptional()
  @IsString()
  apellidoMaternoAdmin?: string;

  @ApiProperty({ example: 'admin.norte@clinica.mx' })
  @IsEmail()
  emailAdmin: string;
}

// ─── Actualizar Sede ──────────────────────────────────────
export class UpdateSedeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domicilio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  emailSede?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenciaSanitaria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;
}

// ─── Asignar Médico a Sede ────────────────────────────────
export class AsignarMedicoDto {
  @ApiProperty()
  @IsUUID()
  medicoId: string;

  @ApiPropertyOptional({ default: false, description: 'Si esta es la sede principal del médico' })
  @IsOptional()
  @IsBoolean()
  esSedeBase?: boolean;
}
