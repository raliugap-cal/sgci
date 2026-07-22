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
  @ApiProperty({ example: 'Clínica Norte' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Grupo Médico Norte S.A. de C.V.' })
  @IsString()
  @MinLength(3)
  razonSocial: string;

  @ApiProperty({ example: 'GMN010101ABC' })
  @IsString()
  @MinLength(12)
  @MaxLength(13)
  rfc: string;

  @ApiProperty({
    example: { calle: 'Insurgentes Sur', numero: '1234', colonia: 'Del Valle', ciudad: 'CDMX', cp: '03100' },
    description: 'Dirección fiscal como objeto JSON',
  })
  @IsObject()
  direccionFiscal: Record<string, any>;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;

  // ── Admin auto-generado ──────────────────────────────────
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
  razonSocial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(13)
  rfc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  direccionFiscal?: Record<string, any>;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  esSedeBase?: boolean;
}
