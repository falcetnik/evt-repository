import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { PublicRsvpStatus } from '../rsvp.types';

export class PublicRsvpDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(80)
  guestName!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MinLength(1)
  @MaxLength(320)
  @IsEmail()
  guestEmail!: string;

  @IsIn(['going', 'maybe', 'not_going'])
  status!: PublicRsvpStatus;
}
