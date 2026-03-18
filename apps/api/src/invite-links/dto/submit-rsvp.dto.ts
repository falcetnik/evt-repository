import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimAndLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SubmitRsvpDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  guestName!: string;

  @Transform(trimAndLowercase)
  @IsString()
  @MinLength(1)
  @MaxLength(320)
  @IsEmail()
  guestEmail!: string;

  @IsString()
  @IsIn(['going', 'maybe', 'not_going'])
  status!: 'going' | 'maybe' | 'not_going';
}
