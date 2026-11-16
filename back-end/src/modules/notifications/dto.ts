import { Trim, WhenSupplied } from '../../common/form-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayUnique, IsBoolean, IsIn, IsNotEmpty, IsString, MinLength, MaxLength, IsDateString } from 'class-validator';
import { NOTIFICATION_TYPES } from '../../common/validation.constants';

export class CreateNotificationDto {
  @ApiProperty({ example: 'u6' }) @IsString() @IsNotEmpty({ message: 'User ID is required.' }) userId: string;
  @ApiPropertyOptional({ example: 'New session scheduled' }) @WhenSupplied() @IsString() @MinLength(1) title?: string;
  @ApiProperty({ example: 'New session scheduled' }) @Trim() @IsString() @IsNotEmpty({ message: 'Message is required.' }) @MaxLength(5000) message: string;
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES, example: 'info' }) @WhenSupplied() @IsIn(NOTIFICATION_TYPES as any, { message: 'Invalid notification type.' }) type?: string;
  @ApiPropertyOptional({ example: false }) @WhenSupplied() @IsBoolean() read?: boolean;
  @ApiPropertyOptional({ example: 'n1' }) @WhenSupplied() @IsString() id?: string;
  @ApiPropertyOptional({ example: '2026-05-03T00:00:00.000Z' }) @WhenSupplied() @IsDateString() createdAt?: string;
}
export class UpdateNotificationDto {
  @ApiPropertyOptional() @WhenSupplied() @IsString() @MinLength(1) title?: string;
  @ApiPropertyOptional() @WhenSupplied() @Trim() @IsString() @MinLength(1) @MaxLength(5000) message?: string;
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES }) @WhenSupplied() @IsIn(NOTIFICATION_TYPES as any) type?: string;
  @ApiPropertyOptional() @WhenSupplied() @IsBoolean() read?: boolean;
}
export class SendNotificationsDto {
 @WhenSupplied() @IsBoolean() all?: boolean;
 @WhenSupplied() @IsArray() @ArrayUnique() @IsString({each:true}) userIds?:string[];
 @Trim() @IsString() @MinLength(3) @MaxLength(5000) message:string;
 @WhenSupplied() @IsString() title?:string;
}
