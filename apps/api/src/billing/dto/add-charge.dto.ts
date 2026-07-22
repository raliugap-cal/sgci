import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class AddChargeDto {
  @IsString() concepto: string;
  @IsString() claveSAT: string;
  @IsString() @IsOptional() claveUnidadSAT?: string;
  @IsString() @IsOptional() servicioId?: string;
  @IsNumber() @Min(0) precioUnitario: number;
  @IsNumber() @IsOptional() @Min(0) cantidad?: number;
  @IsBoolean() @IsOptional() ivaAplicable?: boolean;
  @IsNumber() @IsOptional() tasaIva?: number;
  @IsNumber() @IsOptional() descuento?: number;
}
