import { describe, expect, it } from 'vitest';
import { parseReminderOffsetsInput } from './reminder-editor-model';

describe('reminder editor model', () => {
  it('parses valid comma-separated values preserving order', () => {
    expect(parseReminderOffsetsInput('1440, 120, 30')).toEqual({
      ok: true,
      offsetsMinutes: [1440, 120, 30],
    });
  });

  it('treats empty input as valid empty schedule', () => {
    expect(parseReminderOffsetsInput('   ')).toEqual({
      ok: true,
      offsetsMinutes: [],
    });
  });

  it('rejects duplicate values', () => {
    expect(parseReminderOffsetsInput('5, 5')).toEqual({
      ok: false,
      message: 'Duplicate reminder offsets are not allowed.',
    });
  });

  it('rejects non-integer values', () => {
    expect(parseReminderOffsetsInput('15, abc')).toEqual({
      ok: false,
      message: 'Reminder offsets must be whole numbers.',
    });
  });

  it('rejects out-of-range values', () => {
    expect(parseReminderOffsetsInput('4, 30')).toEqual({
      ok: false,
      message: 'Reminder offsets must be between 5 and 10080 minutes.',
    });
  });

  it('rejects malformed comma lists with empty segments', () => {
    expect(parseReminderOffsetsInput('5, , 10')).toEqual({
      ok: false,
      message: 'Reminder list is malformed. Remove empty values between commas.',
    });
  });

  it('rejects more than five reminders', () => {
    expect(parseReminderOffsetsInput('5, 10, 15, 20, 25, 30')).toEqual({
      ok: false,
      message: 'You can set at most 5 reminders.',
    });
  });
});
