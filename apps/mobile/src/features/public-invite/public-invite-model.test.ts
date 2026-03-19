import { describe, expect, it } from 'vitest';
import { mapPublicInviteToViewModel } from './public-invite-model';

describe('public invite model', () => {
  it('maps fallbacks and summary labels', () => {
    const view = mapPublicInviteToViewModel({
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      expiresAt: null,
      event: {
        title: 'Friday Board Games',
        description: null,
        location: null,
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: null,
        allowPlusOnes: false,
      },
      rsvpSummary: {
        going: 3,
        maybe: 1,
        notGoing: 1,
        total: 5,
        confirmedGoing: 2,
        waitlistedGoing: 1,
        capacityLimit: null,
        remainingSpots: null,
        isFull: false,
      },
    });

    expect(view.event.descriptionLabel).toBe('Description: No description');
    expect(view.event.locationLabel).toBe('Location: Location not set');
    expect(view.event.capacityLabel).toBe('Capacity: No limit');
    expect(view.expiryLabel).toBe('Expiry: No expiry');
    expect(view.summary.notGoingLabel).toBe('Not going: 1');
    expect(view.summary.remainingSpotsLabel).toBe('Remaining spots: Unlimited');
    expect(view.summary.isFullLabel).toBe('Full: No');
  });
});
