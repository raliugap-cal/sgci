import { IsString, IsOptional } from 'class-validator';
export class CreateInvoiceDto {
  @IsString() pacienteId: string;
  @IsString() @IsOptional() consultaId?: string;
  @IsString() @IsOptional() rfcReceptor?: string;
  @IsString() @IsOptional() razonSocialReceptor?: string;
  @IsString() @IsOptional() usoCfdi?: string;
  @IsString() @IsOptional() regimenFiscalReceptor?: string;
}
