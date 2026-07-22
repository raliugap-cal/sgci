// ═══════════════════════════════════════════════════════════
// AVAILABILITY DTO
// ═══════════════════════════════════════════════════════════
import { IsString, IsEnum, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoCita } from '@prisma/client';
import { Transform } from 'class-transformer';

export class AvailabilityDto {
  @ApiProperty()
  @IsUUID()
  medicoId: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsString()
  fecha: string;

  @ApiProperty({ enum: TipoCita })
  @IsEnum(TipoCita)
  tipoCita: TipoCita;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  esTelemedicina?: boolean;

  // Inyectado por el guard/decorator — no viene del query
  sedeId?: string;
}
