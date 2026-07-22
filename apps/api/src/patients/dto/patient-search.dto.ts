import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PatientSearchDto {
  @IsString() @IsOptional() q?: string;
  @IsString() @IsOptional() curp?: string;
  @IsInt() @Min(1) @Type(() => Number) @IsOptional() page?: number = 1;
  @IsInt() @Min(1) @Type(() => Number) @IsOptional() limit?: number = 20;
}
