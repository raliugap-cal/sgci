import { IsString, IsOptional } from 'class-validator';

export class CheckInDto {
  @IsString() @IsOptional() notasRecepcion?: string;
  @IsString() @IsOptional() observaciones?: string;
}
