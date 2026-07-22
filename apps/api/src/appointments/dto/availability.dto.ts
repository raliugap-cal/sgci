import { IsString, IsDateString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { TipoCita } from '@prisma/client';

export class AvailabilityDto {
  @IsString() medicoId: string;
  @IsDateString() fecha: string;
  @IsEnum(TipoCita) tipoCita: TipoCita;
  @IsBoolean() @IsOptional() esTelemedicina?: boolean;
}
