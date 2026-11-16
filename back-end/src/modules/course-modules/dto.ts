import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, IsUrl, Min, MinLength } from 'class-validator';
import { MODULE_TYPES } from '../../common/validation.constants';
export class CreateCourseModuleDto {
  @ApiProperty({ example: 'Market Basics', minLength: 3 }) @Trim() @IsString() @MinLength(3, { message: 'Module title must be at least 3 characters.' }) title: string;
  @ApiPropertyOptional({ enum: MODULE_TYPES, example: 'video' }) @WhenSupplied() @IsIn(MODULE_TYPES as any, { message: 'Invalid module type.' }) type?: string;
  @ApiPropertyOptional({ example: '15 min' }) @WhenSupplied() @IsString() duration?: string;
  @ApiProperty({ example: 1, minimum: 1 }) @FormNumber() @IsInt() @Min(1, { message: 'Module order must be a positive integer.' }) order: number;
  @ApiPropertyOptional({ example: 'https://example.com/video.mp4' }) @WhenSupplied() @Trim() @IsUrl({ require_protocol: true, protocols: ['http','https'] }, { message: 'Material URL must start with http:// or https://.' }) url?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() description?: string;
}
export class UpdateCourseModuleDto {
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MinLength(3) title?: string;
  @ApiPropertyOptional({ enum: MODULE_TYPES }) @WhenSupplied() @IsIn(MODULE_TYPES as any) type?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() duration?: string;
  @ApiPropertyOptional({ minimum: 1 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) order?: number;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsUrl({ require_protocol: true, protocols: ['http','https'] }) url?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() description?: string;
}
