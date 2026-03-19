import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { IsIanaTimezone } from './iana-timezone.validator';

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export class UpdateEventDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(240)
  location?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsIanaTimezone()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null ? null : value))
  @Type(() => Number)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(10000)
  capacityLimit?: number | null;
}
