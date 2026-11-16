import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example:'IIIT Sri City' }) @Trim() @IsString() @MinLength(3) name:string;
  @ApiProperty({ example:'IIITS' }) @Trim() @IsString() @Matches(/^[A-Z][A-Z0-9_-]{1,11}$/, { message:'Institution code must be 2–12 uppercase letters/numbers and start with a letter.' }) code:string;
  @ApiProperty({ example:'finance@iiits.in' }) @Trim() @IsEmail() billingEmail:string;
  @ApiPropertyOptional({ example:500 }) @WhenSupplied() @FormNumber() @IsInt() @Min(1) @Max(100000) seats?:number;
  @ApiPropertyOptional({ example:150000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(1) annualPrice?:number;
  @ApiPropertyOptional({ example:200 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0) perStudentFee?:number;
}

export class AddOrganizationMemberDto {
  @ApiProperty({ example:'u6' }) @IsString() @IsNotEmpty() userId:string;
}

export class SubmitCourseReviewDto {
  @ApiPropertyOptional({ example:12000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0) quotedPrice?:number;
  @ApiPropertyOptional({ example:'Includes 12 modules, videos, PDFs and assessments.' }) @WhenSupplied() @IsString() note?:string;
}

export class CounterOfferDto {
  @ApiProperty({ example:9500 }) @FormNumber() @IsNumber() @Min(0) offeredPrice:number;
  @ApiPropertyOptional({ example:'Budget approved at this amount.' }) @WhenSupplied() @IsString() message?:string;
}

export class ApproveCourseDto {
  @ApiPropertyOptional({ example:9500 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0) sanctionedAmount?:number;
}


export class InstructorMonthlyPayoutDto {
  @ApiPropertyOptional({ example:'2026-08', description:'Billing month in YYYY-MM. Defaults to the current month.' }) @WhenSupplied() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message:'Month must be YYYY-MM.' }) month?:string;
}

export class InstructorBonusDto {
  @ApiProperty({ example:1500 }) @FormNumber() @IsNumber() @Min(0) amount:number;
  @ApiPropertyOptional({ example:'Excellent learner skill-point growth this month.' }) @WhenSupplied() @IsString() reason?:string;
}

export class InstructorRateDto {
  @ApiProperty({ example:500 }) @FormNumber() @IsNumber() @Min(0) perStudentMonthlyRate:number;
}

export class ProviderPayoutDto {
  @FormNumber() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000)
  amount: number;

  @Trim() @IsString() @MinLength(1) @MaxLength(1000)
  reason: string;

  @IsUUID('4')
  requestId: string;
}
