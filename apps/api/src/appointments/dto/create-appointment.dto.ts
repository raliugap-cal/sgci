import { IsString, IsDateString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { TipoCita } from '@prisma/client';

export class CreateAppointmentDto {
  @IsString() pacienteId: string;
  @IsString() medicoId: string;
  @IsEnum(TipoCita) tipoCita: TipoCita;
  @IsDateString() fechaInicio: string;
  @IsBoolean() @IsOptional() esTelemedicina?: boolean;
  @IsString() @IsOptional() motivoConsulta?: string;
  @IsString() @IsOptional() notasRecepcion?: string;
  @IsString() @IsOptional() notas?: string;
}
