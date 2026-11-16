import { FormNumber, Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EXPERIENCE_LEVELS, INDAI_EMAIL_REGEX, INDIAN_PHONE_REGEX, NAME_REGEX, PASSWORD_REGEX, RISK_TOLERANCES, USER_ROLES, USER_STATUSES } from '../../common/validation.constants';

export class CreateUserDto {
  @ApiProperty({ example: 'New', minLength: 3, description: 'Required. Alphabets and spaces only.' })
  @Trim() @IsString() @IsNotEmpty({ message: 'First name is required.' }) @MinLength(3, { message: 'First name must be at least 3 characters.' }) @Matches(NAME_REGEX, { message: 'First name can contain only alphabets and spaces.' })
  firstName: string;

  @ApiProperty({ example: 'Learner', minLength: 3, description: 'Required. Alphabets and spaces only.' })
  @Trim() @IsString() @IsNotEmpty({ message: 'Last name is required.' }) @MinLength(3, { message: 'Last name must be at least 3 characters.' }) @Matches(NAME_REGEX, { message: 'Last name can contain only alphabets and spaces.' })
  lastName: string;

  @ApiProperty({ example: 'new@gmail.com', description: 'Required. Gmail or .in email only.' })
  @Trim() @IsString() @IsNotEmpty({ message: 'Email is required.' }) @Matches(INDAI_EMAIL_REGEX, { message: 'Use a Gmail address or an email ending in .in.' })
  email: string;

  @ApiProperty({ example: 'Test@1234', minLength: 8, description: 'Required. Min 8 chars, uppercase, lowercase, number, and one of !@#$%^&*.' })
  @IsString() @IsNotEmpty({ message: 'Password is required.' }) @Matches(PASSWORD_REGEX, { message: 'Password must be at least 8 characters and include uppercase, lowercase, number and special character.' })
  password: string;

  @ApiPropertyOptional({ example: 'Test@1234', description: 'Optional compatibility field used by frontend/Swagger. If provided, it must match password.' })
  @WhenSupplied() @IsString()
  confirmPassword?: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES as any, { message: 'Invalid role.' })
  role: any;

  @ApiPropertyOptional({ enum: USER_STATUSES, example: 'active' })
  @WhenSupplied() @IsIn(USER_STATUSES as any, { message: 'Invalid status.' })
  status?: string;

  @ApiPropertyOptional({ example: '9876543210', description: 'Optional but if provided must be 10 digits starting with 6/7/8/9.' })
  @WhenSupplied() @Matches(INDIAN_PHONE_REGEX, { message: 'Enter a valid 10-digit Indian mobile number.' })
  phone?: string;

  @ApiPropertyOptional({ example: '2007-05-09', description: 'Required by registration frontend. Learner must be at least 10 years old.' })
  @WhenSupplied() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }, { message: 'Date of Birth must be a valid calendar date.' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'IIIT Sri City', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Institution name must be at least 3 characters.' }) @Matches(/^[^0-9].*$/, { message: 'Institution name cannot start with a number.' })
  institution?: string;

  @ApiPropertyOptional({ example: 'CSE2026', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Student ID must be at least 3 characters.' })
  studentId?: string;

  @ApiPropertyOptional({ example: 'BTech 2nd Year', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Grade / Level must be at least 3 characters.' })
  grade?: string;

  @ApiPropertyOptional({ example: 'Computer Science', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Course / Major must be at least 3 characters when provided.' })
  major?: string;

  @ApiPropertyOptional({ example: 'IndAI Academy', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Organization name must be at least 3 characters.' }) @Matches(/^[^0-9].*$/, { message: 'Organization cannot start with a number.' })
  organization?: string;

  @ApiPropertyOptional({ example: 'Technical Analysis', minLength: 3 })
  @WhenSupplied() @Trim() @IsString() @MinLength(3, { message: 'Expertise / Specialization must be at least 3 characters.' })
  expertise?: string;

  @ApiPropertyOptional({ example: '3-5' })
  @WhenSupplied() @Trim() @IsString() @IsNotEmpty({ message: 'Years of experience is required for instructors.' })
  yearsExp?: string;

  @ApiPropertyOptional({ example: 5, description: 'Compatibility alias for yearsExp used by some Swagger/frontend payloads.' })
  @WhenSupplied() @FormNumber() @IsNumber() @Min(0) @Max(60)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @WhenSupplied() @Trim() @IsUrl({ require_protocol: true, protocols: ['http','https'] }, { message: 'Website / LinkedIn must be a valid URL starting with http:// or https://.' })
  website?: string;

  @ApiPropertyOptional({ enum:['Video Courses','Text Modules','Mixed'], example: 'Video Courses' })
  @WhenSupplied() @IsIn(['Video Courses','Text Modules','Mixed'], { message: 'Invalid content type.' })
  contentType?: string;

  @ApiPropertyOptional({ example: 'ADMIN2024', description:'Required for public User Admin / Payment Admin registration requests.' })
  @WhenSupplied() @Trim() @IsString() @IsNotEmpty({ message: 'Authorization code is required.' })
  authCode?: string;

  @ApiPropertyOptional({ example: 'Full' })
  @WhenSupplied() @IsString() @IsNotEmpty({ message: 'Admin access level is required.' })
  accessLevel?: string;

  @ApiPropertyOptional({ enum:['USER_ADMIN','PAYMENT_ADMIN'], description:'Requested/assigned admin division. Public admin requests remain pending until Super Admin approval.' })
  @WhenSupplied() @IsIn(['USER_ADMIN','PAYMENT_ADMIN'], { message:'Admin team must be USER_ADMIN or PAYMENT_ADMIN.' })
  adminTeam?: 'USER_ADMIN'|'PAYMENT_ADMIN';

  @ApiPropertyOptional({ enum: EXPERIENCE_LEVELS })
  @WhenSupplied() @IsIn(EXPERIENCE_LEVELS as any, { message: 'Invalid experience level.' })
  tradingExperience?: string;

  @ApiPropertyOptional({ enum: EXPERIENCE_LEVELS, description: 'Compatibility alias for experience/tradingExperience.' })
  @WhenSupplied() @IsIn(EXPERIENCE_LEVELS as any, { message: 'Invalid experience level.' })
  experienceLevel?: string;

  @ApiPropertyOptional({ enum: RISK_TOLERANCES })
  @WhenSupplied() @IsIn(RISK_TOLERANCES as any, { message: 'Invalid risk tolerance.' })
  riskTolerance?: string;

  @ApiPropertyOptional({ example: 100000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0)
  startingBalance?: number;
  @ApiPropertyOptional({ example: 150000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0)
  tradingLimit?: number;
  @ApiPropertyOptional({ example: 'u3' }) @WhenSupplied() @IsString()
  instructorId?: string;

  @ApiPropertyOptional({ example: 50 }) @WhenSupplied() @FormNumber() @IsInt() @Min(0)
  skillPoints?: number;
  @ApiPropertyOptional({ example: 100000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0)
  portfolioValue?: number;
  @ApiPropertyOptional({ example: 100000 }) @WhenSupplied() @FormNumber() @IsNumber() @Min(0)
  virtualBalance?: number;
  @ApiPropertyOptional({ example: 'Beginner' }) @WhenSupplied() @IsString()
  experience?: string;
  @ApiPropertyOptional({ example: 'Learn paper trading safely', maxLength:500 }) @WhenSupplied() @IsString() @MaxLength(500, { message:'Learning goals cannot exceed 500 characters.' })
  goals?: string;
  @ApiPropertyOptional({ type: [String], example: [] }) @WhenSupplied() @IsArray() @IsString({ each:true })
  studentIds?: string[];
}


export class UpdateUserDto {
  @WhenSupplied() @Trim() @IsString() @MinLength(3) organization?:string;
  @WhenSupplied() @Trim() @IsString() @MinLength(3) expertise?:string;
  @WhenSupplied() @Trim() @IsString() yearsExp?:string;
  @WhenSupplied() @Trim() @IsString() @MinLength(3) studentId?:string;

  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @MinLength(3) @Matches(NAME_REGEX, { message: 'First name can contain only alphabets and spaces.' }) firstName?: string;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @MinLength(3) @Matches(NAME_REGEX, { message: 'Last name can contain only alphabets and spaces.' }) lastName?: string;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @Matches(INDAI_EMAIL_REGEX, { message: 'Use a Gmail address or an email ending in .in.' }) email?: string;
  @ApiPropertyOptional({ enum: USER_STATUSES }) @WhenSupplied() @IsIn(USER_STATUSES as any) status?: string;
  @ApiPropertyOptional() @WhenSupplied() @Matches(INDIAN_PHONE_REGEX, { message: 'Enter a valid 10-digit Indian mobile number.' }) phone?: string;
  @ApiPropertyOptional() @WhenSupplied() @FormNumber() @IsNumber() @Min(0) tradingLimit?: number;
  @ApiPropertyOptional() @WhenSupplied() @FormNumber() @IsInt() @Min(0) skillPoints?: number;
  @ApiPropertyOptional() @WhenSupplied() @IsString() instructorId?: string;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @MinLength(3) @Matches(/^[^0-9].*$/, { message: 'Institution name cannot start with a number.' }) institution?: string;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @MinLength(3) major?: string;
  @ApiPropertyOptional({ description:'Course Provider verification flag. Super Admin sets this after verification.' }) @WhenSupplied() @IsBoolean() providerVerified?: boolean;
  @ApiPropertyOptional({ enum:['USER_ADMIN','PAYMENT_ADMIN'] }) @WhenSupplied() @IsIn(['USER_ADMIN','PAYMENT_ADMIN']) adminTeam?: 'USER_ADMIN'|'PAYMENT_ADMIN';
}

export class DeleteUserDto {
  @Trim() @IsString() @MinLength(1, { message: 'Enter a reason for deleting this account.' }) @MaxLength(1000)
  reason: string;
}

export class BulkLearnersDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  rows: unknown[];
}
