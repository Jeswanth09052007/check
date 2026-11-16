import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { Trim } from '../../common/form-validation';
import { PASSWORD_REGEX, USER_ROLES } from '../../common/validation.constants';

export class LoginDto {
  @ApiProperty({ example: 'learner@indai.com', description: 'Required. Frontend allows Gmail or email ending with .in only.' })
  @IsString()
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @ApiProperty({ example: 'Learn@1234', description: 'Required password.' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({ enum: USER_ROLES, example: 'LEARNER', description: 'Optional selected role from frontend login/register.' })
  @IsOptional()
  @IsIn(USER_ROLES as any, { message: 'Invalid role.' })
  role?: string;
}

export class OtpDto {
  @IsString() @IsNotEmpty() challengeId: string;
  @IsString() @Matches(/^[0-9]{6}$/, {message:'OTP must contain exactly six digits.'}) otp: string;
}
export class ForgotPasswordDto {
  @Trim() @IsEmail() email: string;
}
export class ResetPasswordDto extends OtpDto {
  @IsString() @Matches(PASSWORD_REGEX, { message: 'Password needs 8 characters, uppercase, lowercase, a number and a special character.' }) password: string;
  @IsString() confirmPassword: string;
}

export class ResendOtpDto {
  @IsString() @IsNotEmpty() challengeId: string;
}
