import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, Max, Min } from 'class-validator';
import {
  REMINDER_MAX_COUNT,
  REMINDER_MAX_OFFSET_MINUTES,
  REMINDER_MIN_OFFSET_MINUTES,
} from '../reminders/reminder-schedule';

export class ReplaceEventRemindersDto {
  @IsArray()
  @ArrayMaxSize(REMINDER_MAX_COUNT)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(REMINDER_MIN_OFFSET_MINUTES, { each: true })
  @Max(REMINDER_MAX_OFFSET_MINUTES, { each: true })
  offsetsMinutes!: number[];
}
