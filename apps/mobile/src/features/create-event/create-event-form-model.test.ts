import { describe, expect, it } from 'vitest';
import { buildCreateEventPayloadFromForm } from './create-event-form-model';

describe('create-event form model', () => {
  it('normalizes field values and returns payload when form is valid', () => {
    const result = buildCreateEventPayloadFromForm({
      title: '  Friday Board Games  ',
      description: '  Bring drinks if you want  ',
      location: '  Prospekt Mira 10  ',
      startsAt: ' 2099-03-25T19:30:00.000Z ',
      timezone: ' Europe/Moscow ',
      capacityLimit: ' 8 ',
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        title: 'Friday Board Games',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 10',
        startsAt: '2099-03-25T19:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
      },
    });
  });

  it('validates required fields', () => {
    const result = buildCreateEventPayloadFromForm({
      title: '   ',
      description: 'optional',
      location: 'optional',
      startsAt: '   ',
      timezone: '   ',
      capacityLimit: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.title).toBe('Title is required.');
      expect(result.fieldErrors.startsAt).toBe('Starts at is required.');
      expect(result.fieldErrors.timezone).toBe('Timezone is required.');
    }
  });

  it('rejects non-integer and less-than-one capacity values', () => {
    const decimalCapacity = buildCreateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '',
      location: '',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'UTC',
      capacityLimit: '2.5',
    });

    expect(decimalCapacity.ok).toBe(false);
    if (!decimalCapacity.ok) {
      expect(decimalCapacity.fieldErrors.capacityLimit).toBe('Capacity limit must be a whole number greater than or equal to 1.');
    }

    const lowCapacity = buildCreateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '',
      location: '',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'UTC',
      capacityLimit: '0',
    });

    expect(lowCapacity.ok).toBe(false);
    if (!lowCapacity.ok) {
      expect(lowCapacity.fieldErrors.capacityLimit).toBe('Capacity limit must be a whole number greater than or equal to 1.');
    }
  });

  it('rejects invalid startsAt ISO values', () => {
    const result = buildCreateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '',
      location: '',
      startsAt: 'not-a-date',
      timezone: 'UTC',
      capacityLimit: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.startsAt).toBe('Starts at must be a valid ISO date string.');
    }
  });

  it('converts empty optional fields to null payload values', () => {
    const result = buildCreateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '   ',
      location: '   ',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'UTC',
      capacityLimit: '   ',
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        title: 'Friday Board Games',
        description: null,
        location: null,
        startsAt: '2099-03-25T19:30:00.000Z',
        timezone: 'UTC',
        capacityLimit: null,
      },
    });
  });
});
