import { BadRequestException } from '@nestjs/common';
import { buildReminderPlan } from '../src/events/reminders/reminder-schedule';

describe('event reminder schedule helper', () => {
  const startsAt = new Date('2026-03-25T18:00:00.000Z');
  const now = new Date('2026-03-20T18:00:00.000Z');

  it('rejects duplicate offsets', () => {
    expect(() => buildReminderPlan({ startsAt, offsetsMinutes: [120, 120], now })).toThrow(BadRequestException);
  });

  it('rejects offsets outside allowed bounds', () => {
    expect(() => buildReminderPlan({ startsAt, offsetsMinutes: [4], now })).toThrow('offsetsMinutes must be between 5 and 10080 minutes');
    expect(() => buildReminderPlan({ startsAt, offsetsMinutes: [10081], now })).toThrow('offsetsMinutes must be between 5 and 10080 minutes');
  });

  it('computes sendAt and sorts output deterministically', () => {
    const reminders = buildReminderPlan({ startsAt, offsetsMinutes: [30, 1440, 120], now });

    expect(reminders.map((item: { offsetMinutes: number }) => item.offsetMinutes)).toEqual([1440, 120, 30]);
    expect(reminders.map((item: { sendAt: Date }) => item.sendAt.toISOString())).toEqual([
      '2026-03-24T18:00:00.000Z',
      '2026-03-25T16:00:00.000Z',
      '2026-03-25T17:30:00.000Z',
    ]);
  });

  it('rejects reminders that would send in the past', () => {
    expect(() =>
      buildReminderPlan({
        startsAt: new Date('2026-03-20T18:05:00.000Z'),
        offsetsMinutes: [5],
        now: new Date('2026-03-20T18:04:00.000Z'),
      }),
    ).toThrow('Reminder sendAt must be in the future and before event start');
  });
});
