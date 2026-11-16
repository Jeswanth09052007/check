import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsString, Max, Min, MinLength } from 'class-validator';
export class UpdateConfigDto {
  @ApiPropertyOptional({ example: 10, minimum: 1 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) maxDailyTrades?: number;
  @ApiPropertyOptional({ example: 150000, minimum: 1 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) defaultTradingLimit?: number;
  @ApiPropertyOptional({ example: false }) @WhenSupplied() @IsBoolean() maintenanceMode?: boolean;
  @ApiPropertyOptional({ example: 'IndAI', minLength: 2 }) @WhenSupplied() @Trim() @IsString() @MinLength(2) platformName?: string;
  @ApiPropertyOptional({ example: 100000, minimum: 1 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) maxLimit?: number;
  @ApiPropertyOptional({ example: 200, minimum: 1 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) maxPts?: number;
  @ApiPropertyOptional({ example: 10, minimum: 0 }) @WhenSupplied() @FormNumber() @IsInt() @Min(0) minMargin?: number;
  @ApiPropertyOptional({ example: 60, minimum: 0 }) @WhenSupplied() @FormNumber() @IsInt() @Min(0) cooldown?: number;
}
export class AssignInstructorDto {
  @ApiProperty({ example: 'u6' }) @IsString() @IsNotEmpty({ message: 'learnerId is required.' }) learnerId: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty({ message: 'instructorId is required.' }) instructorId: string;
}
