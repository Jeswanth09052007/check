import { FormNumber, RejectionRemarkDto, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';
import { SESSION_STATUSES } from '../../common/validation.constants';

export class CreateSessionDto {
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty({ message: 'Instructor ID is required.' }) instructorId: string;
  @ApiProperty({ example: 'Live Trading Practice', minLength: 3 }) @Trim() @IsString() @MaxLength(200) @MinLength(3, { message: 'Session title must be at least 3 characters.' }) title: string;
  @ApiPropertyOptional({ example: 'Practice session', minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MaxLength(10000) @Matches(/^(?:[\s\S]{3,})?$/, { message: 'Description must be empty or at least 3 characters.' }) description?: string;
  @ApiProperty({ example: '2026-05-10', description: 'IST. Start must be at least one hour ahead and within 365 days.' }) @IsString() @IsNotEmpty({ message: 'Session date is required.' }) date: string;
  @ApiProperty({ example: '10:00' }) @IsString() @IsNotEmpty({ message: 'Time is required.' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:mm format.' }) time: string;
  @ApiPropertyOptional({ type: [String], example: ['u6'] }) @WhenSupplied() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true }) studentIds?: string[];
  @ApiPropertyOptional({ example: 60, minimum: 15, maximum: 480 }) @WhenSupplied() @FormNumber() @IsInt() @Min(15) @Max(480) duration?: number;
  @ApiPropertyOptional({ enum: SESSION_STATUSES, example: 'scheduled' }) @WhenSupplied() @IsIn(SESSION_STATUSES as any, { message: 'Invalid session status.' }) status?: string;
  @ApiPropertyOptional({ example: 'Trading Session' }) @WhenSupplied() @IsString() type?: string;
}
export class UpdateSessionDto {
  @ApiPropertyOptional() @WhenSupplied() @IsString() instructorId?: string;
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MaxLength(200) @MinLength(3) title?: string;
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MaxLength(10000) @Matches(/^(?:[\s\S]{3,})?$/, { message: 'Description must be empty or at least 3 characters.' }) description?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() date?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:mm format.' }) time?: string;
  @ApiPropertyOptional({ type: [String] }) @WhenSupplied() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true }) studentIds?: string[];
  @ApiPropertyOptional({ minimum: 15, maximum: 480 }) @WhenSupplied() @FormNumber() @IsInt() @Min(15) @Max(480) duration?: number;
  @ApiPropertyOptional({ enum: SESSION_STATUSES }) @WhenSupplied() @IsIn(SESSION_STATUSES as any) status?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() type?: string;
}

export class AcceptSessionDto {
  @ApiPropertyOptional() @WhenSupplied() @IsString() @IsNotEmpty() @MaxLength(80)
  expectedRevision?: string;
}

export class RejectSessionDto extends RejectionRemarkDto {
  @ApiPropertyOptional() @WhenSupplied() @IsString() @IsNotEmpty() @MaxLength(80)
  expectedRevision?: string;
}
