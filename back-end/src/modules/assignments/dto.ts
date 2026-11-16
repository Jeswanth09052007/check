import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ASSIGNMENT_STATUSES, DIFFICULTIES } from '../../common/validation.constants';

export class CreateAssignmentDto {
  @ApiProperty({ example: 'Trading Plan', minLength: 3 }) @Trim() @IsString() @MaxLength(200) @MinLength(3) title: string;
  @ApiProperty({ example: 'Submit a paper trade plan.', minLength: 3 }) @Trim() @IsString() @MaxLength(10000) @MinLength(3) description: string;
  @ApiProperty({ example: 'u3' }) @WhenSupplied() @IsString() instructorId?: string;
  @WhenSupplied() @IsString() providerId?: string;
  @WhenSupplied() @IsString() courseId?: string;
  @ApiPropertyOptional({ type: [String], example: ['u6'] }) @WhenSupplied() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true }) studentIds?: string[];
  @ApiProperty({ example: '2026-05-20', description: 'Must be a future date within 365 days.' }) @IsString() @IsNotEmpty({ message: 'Due date is required.' }) dueDate: string;
  @ApiProperty({ example: 50, minimum: 1, maximum: 200 }) @FormNumber() @IsInt() @Min(1) @Max(200) skillPoints: number;
  @ApiPropertyOptional({ enum: DIFFICULTIES, example: 'Medium' }) @WhenSupplied() @IsIn(DIFFICULTIES as any, { message: 'Invalid difficulty.' }) difficulty?: string;
  @ApiPropertyOptional({ enum: ASSIGNMENT_STATUSES, example: 'active' }) @WhenSupplied() @IsIn(ASSIGNMENT_STATUSES as any, { message: 'Invalid assignment status.' }) status?: string;
  @ApiPropertyOptional({ example: 'Trading Challenge' }) @WhenSupplied() @IsString() type?: string;
}
export class UpdateAssignmentDto {
 @WhenSupplied() @IsString() providerId?:string;
 @WhenSupplied() @IsString() courseId?:string;
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MaxLength(200) @MinLength(3) title?: string;
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MaxLength(10000) @MinLength(3) description?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() instructorId?: string;
  @ApiPropertyOptional({ type: [String] }) @WhenSupplied() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true }) studentIds?: string[];
  @ApiPropertyOptional() @WhenSupplied() @IsString() dueDate?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 200 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(200) skillPoints?: number;
  @ApiPropertyOptional({ enum: DIFFICULTIES }) @WhenSupplied() @IsIn(DIFFICULTIES as any) difficulty?: string;
  @ApiPropertyOptional({ enum: ASSIGNMENT_STATUSES }) @WhenSupplied() @IsIn(ASSIGNMENT_STATUSES as any) status?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() type?: string;
}
export class SubmitAssignmentDto {
  @ApiProperty({ example: 'u6' }) @IsString() @IsNotEmpty({ message: 'learnerId is required.' }) learnerId: string;
  @ApiProperty({ example: 'My solution text' }) @Trim() @IsString() @MinLength(1, { message: 'Enter your solution.' }) @MaxLength(20000) submissionText: string;
}
