export type ReminderEditorParseResult =
  | {
      ok: true;
      offsetsMinutes: number[];
    }
  | {
      ok: false;
      message: string;
    };

const MIN_OFFSET_MINUTES = 5;
const MAX_OFFSET_MINUTES = 10080;
const MAX_REMINDERS = 5;

const INTEGER_PATTERN = /^-?\d+$/;

export const parseReminderOffsetsInput = (input: string): ReminderEditorParseResult => {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    return { ok: true, offsetsMinutes: [] };
  }

  const segments = trimmedInput.split(',').map((segment) => segment.trim());

  if (segments.some((segment) => segment.length === 0)) {
    return {
      ok: false,
      message: 'Reminder list is malformed. Remove empty values between commas.',
    };
  }

  if (segments.length > MAX_REMINDERS) {
    return {
      ok: false,
      message: 'You can set at most 5 reminders.',
    };
  }

  if (segments.some((segment) => !INTEGER_PATTERN.test(segment))) {
    return {
      ok: false,
      message: 'Reminder offsets must be whole numbers.',
    };
  }

  const offsetsMinutes = segments.map((segment) => Number.parseInt(segment, 10));

  if (offsetsMinutes.some((offsetMinutes) => offsetMinutes < MIN_OFFSET_MINUTES || offsetMinutes > MAX_OFFSET_MINUTES)) {
    return {
      ok: false,
      message: 'Reminder offsets must be between 5 and 10080 minutes.',
    };
  }

  const uniqueCount = new Set(offsetsMinutes).size;
  if (uniqueCount !== offsetsMinutes.length) {
    return {
      ok: false,
      message: 'Duplicate reminder offsets are not allowed.',
    };
  }

  return { ok: true, offsetsMinutes };
};
