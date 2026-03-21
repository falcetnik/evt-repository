import { describe, expect, it } from 'vitest';
import type { OrganizerEventDetailsBundle } from '../../api/event-details';
import { mapEventDetailsToViewModel } from './event-details-model';

const sampleBundle: OrganizerEventDetailsBundle = {
  event: {
    id: 'evt-1',
    title: 'Launch Party',
    description: 'Celebrate release',
    location: 'HQ',
    startsAt: '2099-01-01T10:00:00.000Z',
    timezone: 'UTC',
    capacityLimit: 10,
    organizerUserId: 'org-1',
    createdAt: '2099-01-01T08:00:00.000Z',
    updatedAt: '2099-01-01T08:00:00.000Z',
  },
  attendees: {
    eventId: 'evt-1',
    summary: {
      total: 3,
      going: 2,
      maybe: 1,
      notGoing: 0,
      confirmedGoing: 1,
      waitlistedGoing: 1,
      capacityLimit: 1,
      remainingSpots: 0,
      isFull: true,
    },
    attendees: [
      {
        attendeeId: 'att-1',
        guestName: 'Alex',
        guestEmail: 'alex@example.com',
        status: 'going',
        attendanceState: 'confirmed',
        waitlistPosition: null,
        createdAt: '2099-01-01T08:00:00.000Z',
        updatedAt: '2099-01-01T08:00:00.000Z',
      },
      {
        attendeeId: 'att-2',
        guestName: 'Taylor',
        guestEmail: 'taylor@example.com',
        status: 'going',
        attendanceState: 'waitlisted',
        waitlistPosition: 2,
        createdAt: '2099-01-01T08:00:00.000Z',
        updatedAt: '2099-01-01T08:00:00.000Z',
      },
    ],
  },
  reminders: {
    eventId: 'evt-1',
    startsAt: '2099-01-01T10:00:00.000Z',
    timezone: 'UTC',
    reminders: [
      {
        reminderId: 'rem-1',
        offsetMinutes: 60,
        sendAt: '2099-01-01T09:00:00.000Z',
      },
    ],
    total: 1,
  },
};

describe('event details model mapper', () => {
  it('maps payload to display-ready sections and labels', () => {
    const model = mapEventDetailsToViewModel(sampleBundle);

    expect(model.event.title).toBe('Launch Party');
    expect(model.event.startsAtLabel).toBe('Starts: 2099-01-01T10:00:00Z');
    expect(model.event.timezoneLabel).toBe('Timezone: UTC');
    expect(model.summary.goingLabel).toBe('Going: 2');
    expect(model.summary.waitlistedGoingLabel).toBe('Waitlisted going: 1');
    expect(model.summary.isFullLabel).toBe('Full: Yes');
    expect(model.attendees[0].status).toBe('going');
    expect(model.attendees[1].attendanceState).toBe('waitlisted');
    expect(model.attendees[1].waitlistPosition).toBe(2);
    expect(model.reminders[0].offsetLabel).toBe('Offset: 60 min before');
    expect(model.reminders[0].sendAtLabel).toBe('Sends at: 2099-01-01T09:00:00Z');
  });

  it('applies fallback labels for missing location, description, and capacity', () => {
    const model = mapEventDetailsToViewModel({
      ...sampleBundle,
      event: {
        ...sampleBundle.event,
        description: null,
        location: null,
        capacityLimit: null,
      },
    });

    expect(model.event.descriptionLabel).toBe('Description: No description');
    expect(model.event.locationLabel).toBe('Location: Location not set');
    expect(model.event.capacityLabel).toBe('Capacity: No limit');
  });

  it('returns section-level empty-state messages for empty attendees and reminders', () => {
    const model = mapEventDetailsToViewModel({
      ...sampleBundle,
      attendees: {
        ...sampleBundle.attendees,
        attendees: [],
      },
      reminders: {
        ...sampleBundle.reminders,
        reminders: [],
        total: 0,
      },
    });

    expect(model.attendees).toEqual([]);
    expect(model.attendeesEmptyMessage).toBe('No attendees yet.');
    expect(model.reminders).toEqual([]);
    expect(model.remindersEmptyMessage).toBe('No reminders scheduled.');
  });
});
