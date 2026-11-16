import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';
import { COURSE_STATUSES, DIFFICULTIES } from '../../common/validation.constants';

export class CreateCourseDto {
  @ApiProperty({ example: 'u5' }) @IsString() @IsNotEmpty({ message: 'Provider ID is required.' }) providerId: string;
  @ApiProperty({ example: 'Paper Trading Basics', minLength: 3 }) @Trim() @IsString() @MinLength(3, { message: 'Course title must be at least 3 characters.' }) title: string;
  @ApiProperty({ example: 'Learn simulated trading.', minLength: 3 }) @Trim() @IsString() @MinLength(3, { message: 'Description must be at least 3 characters.' }) description: string;
  @ApiProperty({ example: 10, minimum: 1, maximum: 200 }) @FormNumber() @IsInt() @Min(1) @Max(200) lessons: number;
  @ApiPropertyOptional({ example: '4 weeks' }) @WhenSupplied() @IsString() duration?: string;
  @ApiProperty({ example: 100, minimum: 1, maximum: 200 }) @FormNumber() @IsInt() @Min(1) @Max(200) skillPoints: number;
  @ApiProperty({ example: 'Trading' }) @Trim() @IsString() @IsNotEmpty({ message: 'Category is required.' }) category: string;
  @ApiPropertyOptional({ enum: DIFFICULTIES, example: 'BEGINNER' }) @WhenSupplied() @IsIn(DIFFICULTIES as any, { message: 'Invalid difficulty.' }) difficulty?: string;
  @ApiPropertyOptional({ enum: COURSE_STATUSES, example: 'draft' }) @WhenSupplied() @IsIn(COURSE_STATUSES as any, { message: 'Invalid status.' }) status?: string;
  @ApiPropertyOptional({ enum:['FREE','PRO'], example:'FREE' }) @WhenSupplied() @IsIn(['FREE','PRO']) accessTier?:string;
  @ApiPropertyOptional({ example:10000, minimum:0, description:'Provider quoted amount for course production/licensing.' }) @WhenSupplied() @Trim() @FormNumber() @IsNumber() @Min(0) quotedPrice?:number;
  @ApiPropertyOptional({ enum:['PLATFORM','ORGANIZATION'], example:'PLATFORM' }) @WhenSupplied() @IsIn(['PLATFORM','ORGANIZATION']) scope?:string;
  @ApiPropertyOptional({ example:'org1' }) @WhenSupplied() @IsString() organizationId?:string;
}
export class UpdateCourseDto {
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MinLength(3) title?: string;
  @ApiPropertyOptional({ minLength: 3 }) @WhenSupplied() @Trim() @IsString() @MinLength(3) description?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 200 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(200) lessons?: number;
  @ApiPropertyOptional() @WhenSupplied() @IsString() duration?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 200 }) @WhenSupplied() @FormNumber() @IsInt() @Min(0) @Max(200) skillPoints?: number;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @IsNotEmpty() category?: string;
  @ApiPropertyOptional({ enum: DIFFICULTIES }) @WhenSupplied() @IsIn(DIFFICULTIES as any) difficulty?: string;
  @ApiPropertyOptional({ enum: COURSE_STATUSES }) @WhenSupplied() @IsIn(COURSE_STATUSES as any) status?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() providerId?: string;
  @ApiPropertyOptional({ enum:['FREE','PRO'] }) @WhenSupplied() @IsIn(['FREE','PRO']) accessTier?:string;
  @ApiPropertyOptional({ minimum:0 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0) quotedPrice?:number;
  @ApiPropertyOptional({ enum:['PLATFORM','ORGANIZATION'] }) @WhenSupplied() @IsIn(['PLATFORM','ORGANIZATION']) scope?:string;
  @ApiPropertyOptional() @WhenSupplied() @IsString() organizationId?:string;
}
