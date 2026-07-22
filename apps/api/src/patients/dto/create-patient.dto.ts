import { IsString, IsOptional, IsDateString, IsEnum, IsEmail, IsBoolean } from 'class-validator';
import { SexoBiologico, GrupoSanguineo } from '@prisma/client';

export class CreatePatientDto {
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsString() @IsOptional() apellidoMaterno?: string;
  @IsDateString() fechaNacimiento: string;
  @IsEnum(SexoBiologico) sexo: SexoBiologico;
  @IsString() @IsOptional() curp?: string;
  @IsString() @IsOptional() rfc?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() whatsapp?: string;
  @IsString() @IsOptional() estadoCivil?: string;
  @IsString() @IsOptional() ocupacion?: string;
  @IsString() @IsOptional() escolaridad?: string;
  @IsEnum(GrupoSanguineo) @IsOptional() grupoSanguineo?: GrupoSanguineo;
  @IsString() @IsOptional() regimenFiscal?: string;
  @IsString() @IsOptional() usoCfdi?: string;
  @IsString() @IsOptional() generoIdentidad?: string;
  @IsString() @IsOptional() preferenciaMensajeria?: string;
  @IsOptional() direccion?: Record<string, any>;
  @IsBoolean() @IsOptional() consentimientoLFPDPPP?: boolean;
}
