// ═══════════════════════════════════════════════════════════
// UPDATE PATIENT DTO — campos opcionales sin mapped-types
// ═══════════════════════════════════════════════════════════
import {
  IsString, IsEmail, IsOptional, IsEnum,
  IsDateString, IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePatientDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  apellidoPaterno?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  apellidoMaterno?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaNacimiento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  sexo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  generoIdentidad?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  curp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  rfc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  regimenFiscal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  usoCfdi?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail()   email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  telefono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  estadoCivil?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  ocupacion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  escolaridad?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  grupoSanguineo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consentimientoLFPDPPP?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString()  motivoConsulta?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}
