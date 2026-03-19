import { describe, expect, it } from 'vitest';
import { mapEventToCardModel, type OrganizerEventListItem } from './event-card-model';

const sampleEvent: OrganizerEventListItem = {
  id: 'evt-1',
  title: 'Board Games',
  description: null,
  location: null,
  startsAt: '2099-01-01T10:00:00.000Z',
  timezone: 'UTC',
  capacityLimit: null,
  summary: {
    going: 2,
    maybe: 1,
    notGoing: 1,
    total: 4,
    confirmedGoing: 1,
    waitlistedGoing: 1,
    capacityLimit: null,
    remainingSpots: null,
    isFull: false,
  },
  hasActiveInviteLink: true,
  activeReminderCount: 3,
  createdAt: '2099-01-01T09:00:00.000Z',
  updatedAt: '2099-01-01T09:00:00.000Z',
};

describe('event card model mapper', () => {
  it('maps nullable location and capacity to readable fallback labels', () => {
    const card = mapEventToCardModel(sampleEvent);

    expect(card.locationLabel).toBe('Location: Not specified');
    expect(card.capacityLabel).toBe('Capacity: No limit');
  });

  it('builds RSVP, invite, and reminder summary labels', () => {
    const card = mapEventToCardModel({
      ...sampleEvent,
      location: 'Prospekt Mira 10',
      capacityLimit: 10,
      hasActiveInviteLink: false,
      activeReminderCount: 1,
    });

    expect(card.rsvpSummaryLabel).toBe('RSVP: total 4 · going 2 · maybe 1 · not going 1');
    expect(card.inviteLinkLabel).toBe('Invite: Inactive');
    expect(card.reminderLabel).toBe('Reminders: 1 active');
    expect(card.capacityLabel).toBe('Capacity: 10');
  });
});
