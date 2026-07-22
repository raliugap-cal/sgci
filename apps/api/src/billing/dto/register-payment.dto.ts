import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { MetodoPagoSAT } from '@prisma/client';

export class RegisterPaymentDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsEnum(MetodoPagoSAT) metodoPago: MetodoPagoSAT;
  @IsString() @IsOptional() referencia?: string;
  @IsString() @IsOptional() conektaChargeId?: string;
  @IsString() @IsOptional() notas?: string;
}
