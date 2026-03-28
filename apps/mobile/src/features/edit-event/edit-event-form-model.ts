import type { OrganizerEventDetailsResponse } from '../../api/event-details';
import type { UpdateEventInput } from '../../api/update-event';

export type EditEventFormInput = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  timezone: string;
  capacityLimit: string;
  allowPlusOnes: boolean;
};

export type EditEventFormFieldErrors = Partial<Record<keyof EditEventFormInput, string>>;

export type EditEventFormBuildResult =
  | {
      ok: true;
      payload: UpdateEventInput;
    }
  | {
      ok: false;
      fieldErrors: EditEventFormFieldErrors;
      message: string;
    };

const nullIfEmpty = (value: string): string | null => {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

export const buildEditEventInitialForm = (event: OrganizerEventDetailsResponse): EditEventFormInput => ({
  title: event.title,
  description: event.description ?? '',
  location: event.location ?? '',
  startsAt: event.startsAt,
  timezone: event.timezone,
  capacityLimit: event.capacityLimit === null ? '' : String(event.capacityLimit),
  allowPlusOnes: event.allowPlusOnes,
});

export const buildUpdateEventPayloadFromForm = (input: EditEventFormInput): EditEventFormBuildResult => {
  const title = input.title.trim();
  const startsAt = input.startsAt.trim();
  const timezone = input.timezone.trim();
  const description = nullIfEmpty(input.description);
  const location = nullIfEmpty(input.location);
  const capacityLimitRaw = input.capacityLimit.trim();

  const fieldErrors: EditEventFormFieldErrors = {};

  if (title.length === 0) {
    fieldErrors.title = 'Title is required.';
  }

  if (startsAt.length === 0) {
    fieldErrors.startsAt = 'Starts at is required.';
  } else if (Number.isNaN(new Date(startsAt).getTime())) {
    fieldErrors.startsAt = 'Starts at must be a valid ISO date string.';
  }

  if (timezone.length === 0) {
    fieldErrors.timezone = 'Timezone is required.';
  }

  let capacityLimit: number | null = null;
  if (capacityLimitRaw.length > 0) {
    if (!/^[+-]?\d+$/.test(capacityLimitRaw)) {
      fieldErrors.capacityLimit = 'Capacity limit must be a whole number greater than or equal to 1.';
    } else {
      capacityLimit = Number.parseInt(capacityLimitRaw, 10);
      if (!Number.isSafeInteger(capacityLimit) || capacityLimit < 1) {
        fieldErrors.capacityLimit = 'Capacity limit must be a whole number greater than or equal to 1.';
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      message: Object.values(fieldErrors)[0] ?? 'Please fix validation errors.',
    };
  }

  return {
    ok: true,
    payload: {
      title,
      description,
      location,
      startsAt,
      timezone,
      capacityLimit,
      allowPlusOnes: input.allowPlusOnes,
    },
  };
};
