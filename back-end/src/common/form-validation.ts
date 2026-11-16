import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const Trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);
export const FormNumber = () => Transform(({ value }) => {
  if (typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return Number(value);
  }
  return value;
});
export const WhenSupplied = () => ValidateIf((_object, value) => value !== undefined);

export class RejectionRemarkDto {
  @Trim() @IsString() @MinLength(1, { message: 'Enter a rejection remark.' }) @MaxLength(1000)
  remark: string;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
const IST_OFFSET_MS = 330 * 60_000;

export function todayInIndia(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function validateCalendarDate(date: string, field: string) {
  const midnight = Date.parse(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(midnight) ||
      new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new BadRequestException(field + ' must be a valid calendar date.');
  }
  return midnight;
}
