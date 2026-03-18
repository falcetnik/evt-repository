import { BadRequestException } from '@nestjs/common';

export const REMINDER_MIN_OFFSET_MINUTES = 5;
export const REMINDER_MAX_OFFSET_MINUTES = 10080;
export const REMINDER_MAX_COUNT = 5;

export type ReminderPlanEntry = {
  offsetMinutes: number;
  sendAt: Date;
};

export function buildReminderPlan(params: {
  startsAt: Date;
  offsetsMinutes: number[];
  now: Date;
}): ReminderPlanEntry[] {
  const { startsAt, offsetsMinutes, now } = params;

  if (!Array.isArray(offsetsMinutes)) {
    throw new BadRequestException('offsetsMinutes must be an array');
  }

  if (offsetsMinutes.length > REMINDER_MAX_COUNT) {
    throw new BadRequestException(`offsetsMinutes must contain at most ${REMINDER_MAX_COUNT} items`);
  }

  const seenOffsets = new Set<number>();
  const reminders: ReminderPlanEntry[] = [];

  for (const offsetMinutes of offsetsMinutes) {
    if (!Number.isInteger(offsetMinutes)) {
      throw new BadRequestException('offsetsMinutes must contain integer values');
    }

    if (offsetMinutes < REMINDER_MIN_OFFSET_MINUTES || offsetMinutes > REMINDER_MAX_OFFSET_MINUTES) {
      throw new BadRequestException(
        `offsetsMinutes must be between ${REMINDER_MIN_OFFSET_MINUTES} and ${REMINDER_MAX_OFFSET_MINUTES} minutes`,
      );
    }

    if (seenOffsets.has(offsetMinutes)) {
      throw new BadRequestException('offsetsMinutes must not contain duplicates');
    }
    seenOffsets.add(offsetMinutes);

    const sendAt = new Date(startsAt.getTime() - offsetMinutes * 60 * 1000);
    if (sendAt.getTime() <= now.getTime() || sendAt.getTime() >= startsAt.getTime()) {
      throw new BadRequestException('Reminder sendAt must be in the future and before event start');
    }

    reminders.push({ offsetMinutes, sendAt });
  }

  reminders.sort((left, right) => {
    if (left.sendAt.getTime() !== right.sendAt.getTime()) {
      return left.sendAt.getTime() - right.sendAt.getTime();
    }

    return left.offsetMinutes - right.offsetMinutes;
  });

  return reminders;
}
