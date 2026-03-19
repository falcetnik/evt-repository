import { describe, expect, it } from 'vitest';
import { buildPublicRsvpPayloadFromForm } from './public-rsvp-form-model';

describe('public RSVP form model', () => {
  it('trims and normalizes valid form values', () => {
    const result = buildPublicRsvpPayloadFromForm({
      guestName: '  Nikita  ',
      guestEmail: '  Nikita@Example.COM  ',
      status: 'going',
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        guestName: 'Nikita',
        guestEmail: 'nikita@example.com',
        status: 'going',
      },
    });
  });

  it('validates required guest name', () => {
    const result = buildPublicRsvpPayloadFromForm({ guestName: '   ', guestEmail: 'ok@example.com', status: 'going' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.guestName).toBe('Guest name is required.');
    }
  });

  it('validates required guest email', () => {
    const result = buildPublicRsvpPayloadFromForm({ guestName: 'Nikita', guestEmail: '   ', status: 'going' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.guestEmail).toBe('Guest email is required.');
    }
  });

  it('rejects invalid email format', () => {
    const result = buildPublicRsvpPayloadFromForm({ guestName: 'Nikita', guestEmail: 'invalid-email', status: 'going' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.guestEmail).toBe('Enter a valid email address.');
    }
  });

  it('validates status values', () => {
    const result = buildPublicRsvpPayloadFromForm({
      guestName: 'Nikita',
      guestEmail: 'nikita@example.com',
      status: 'later',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.status).toBe('Select an RSVP status.');
    }
  });
});
