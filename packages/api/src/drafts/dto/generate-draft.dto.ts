import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateDraftDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  threadContent!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  macroHint?: string;
}