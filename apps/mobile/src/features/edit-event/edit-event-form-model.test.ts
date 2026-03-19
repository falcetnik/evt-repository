import { describe, expect, it } from 'vitest';
import {
  buildEditEventInitialForm,
  buildUpdateEventPayloadFromForm,
} from './edit-event-form-model';

describe('edit-event form model', () => {
  it('maps initial form values from loaded event details', () => {
    const result = buildEditEventInitialForm({
      id: 'evt-123',
      title: 'Friday Board Games',
      description: null,
      location: 'Prospekt Mira 10',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: 8,
      organizerUserId: 'organizer-1',
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-02T00:00:00.000Z',
    });

    expect(result).toEqual({
      title: 'Friday Board Games',
      description: '',
      location: 'Prospekt Mira 10',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: '8',
    });
  });

  it('trims and normalizes values', () => {
    const result = buildUpdateEventPayloadFromForm({
      title: '  Friday Board Games Updated  ',
      description: '  Bring drinks if you want  ',
      location: '  Prospekt Mira 11  ',
      startsAt: ' 2099-03-26T19:30:00.000Z ',
      timezone: ' Europe/Moscow ',
      capacityLimit: ' 10 ',
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        title: 'Friday Board Games Updated',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 11',
        startsAt: '2099-03-26T19:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 10,
      },
    });
  });

  it('normalizes blank optional strings and blank capacity to null', () => {
    const result = buildUpdateEventPayloadFromForm({
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

  it('validates required fields', () => {
    const result = buildUpdateEventPayloadFromForm({
      title: ' ',
      description: '',
      location: '',
      startsAt: ' ',
      timezone: ' ',
      capacityLimit: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.title).toBe('Title is required.');
      expect(result.fieldErrors.startsAt).toBe('Starts at is required.');
      expect(result.fieldErrors.timezone).toBe('Timezone is required.');
    }
  });

  it('rejects invalid startsAt ISO datetime strings', () => {
    const result = buildUpdateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '',
      location: '',
      startsAt: 'not-an-iso',
      timezone: 'UTC',
      capacityLimit: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.startsAt).toBe('Starts at must be a valid ISO date string.');
    }
  });

  it('rejects invalid capacityLimit values', () => {
    const invalidDecimal = buildUpdateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: '',
      location: '',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'UTC',
      capacityLimit: '2.5',
    });

    expect(invalidDecimal.ok).toBe(false);
    if (!invalidDecimal.ok) {
      expect(invalidDecimal.fieldErrors.capacityLimit).toBe(
        'Capacity limit must be a whole number greater than or equal to 1.',
      );
    }
  });

  it('returns expected success payload shape', () => {
    const result = buildUpdateEventPayloadFromForm({
      title: 'Friday Board Games',
      description: 'Bring snacks',
      location: 'Prospekt Mira 10',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: '12',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        title: 'Friday Board Games',
        description: 'Bring snacks',
        location: 'Prospekt Mira 10',
        startsAt: '2099-03-25T19:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 12,
      });
    }
  });
});
