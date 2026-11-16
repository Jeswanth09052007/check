import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsString, Max, Min, MinLength } from 'class-validator';
export class CreateQuizDto {
  @ApiPropertyOptional({ example: 'c1' }) @WhenSupplied() @IsString() courseId?: string;
  @ApiPropertyOptional({ example: 'u5' }) @WhenSupplied() @IsString() providerId?: string;
  @ApiProperty({ example: 'Basics Quiz', minLength: 3 }) @Trim() @IsString() @MinLength(3, { message: 'Quiz title must be at least 3 characters.' }) title: string;
  @ApiPropertyOptional({ description: 'Frontend may send a question count number; API may also accept question objects.', example: [{ q:'Paper trading?', options:['Virtual','Real'], ans:0 }] }) @WhenSupplied() questions?: any;
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(50) questionCount?: number;
  @ApiPropertyOptional({ enum: ['active','inactive'] }) @WhenSupplied() @IsString() status?: string;
}
export class UpdateQuizDto {
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MinLength(3) title?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() courseId?: string;
  @ApiPropertyOptional() @WhenSupplied() questions?: any;
  @ApiPropertyOptional({ minimum: 1, maximum: 50 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(50) questionCount?: number;
  @ApiPropertyOptional({ minimum: 5, maximum: 120 }) @WhenSupplied() @FormNumber() @IsInt() @Min(5) @Max(120) timeLimit?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(100) passingScore?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @WhenSupplied() @FormNumber() @IsInt() @Min(0) @Max(100) skillPointsOnPass?: number;
  @ApiPropertyOptional() @WhenSupplied() @IsString() instructions?: string;
  @ApiPropertyOptional({ enum: ['active','inactive'] }) @WhenSupplied() @IsString() status?: string;
}
export class SubmitQuizDto {
  @ApiProperty({ example: 'u6' }) @IsString() @IsNotEmpty({ message: 'Learner ID is required.' }) learnerId: string;
  @ApiProperty({ type: [Number], example: [0,1,2] }) @WhenSupplied() @IsArray() @IsInt({ each: true }) answers?: number[];
  @WhenSupplied() @Trim() @IsString() @MinLength(3) submissionText?:string;
}

export class GradeQuizDto {
 @FormNumber() @IsInt() @Min(0) @Max(100) score:number;
 @WhenSupplied() @IsString() feedback?:string;
}
