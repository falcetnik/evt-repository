import { describe, expect, it, vi } from 'vitest';
import { buildEventDetailsRequests, fetchOrganizerEventDetailsBundle } from './event-details';

const sampleEventResponse = {
  id: 'evt-1',
  title: 'Launch Party',
  description: 'Details',
  location: 'HQ',
  startsAt: '2099-01-01T10:00:00.000Z',
  timezone: 'UTC',
  capacityLimit: 10,
  organizerUserId: 'org-1',
  createdAt: '2099-01-01T08:00:00.000Z',
  updatedAt: '2099-01-01T08:00:00.000Z',
};

const sampleAttendeesResponse = {
  eventId: 'evt-1',
  summary: {
    total: 2,
    going: 2,
    maybe: 0,
    notGoing: 0,
    confirmedGoing: 1,
    waitlistedGoing: 1,
    capacityLimit: 1,
    remainingSpots: 0,
    isFull: true,
  },
  attendees: [],
};

const sampleRemindersResponse = {
  eventId: 'evt-1',
  startsAt: '2099-01-01T10:00:00.000Z',
  timezone: 'UTC',
  reminders: [],
  total: 0,
};

describe('event details API helper', () => {
  it('builds request paths for event, attendees, and reminders and includes dev header when enabled', () => {
    const request = buildEventDetailsRequests({
      baseUrl: 'http://10.0.2.2:3000/api/',
      eventId: 'evt-1',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.event.path).toBe('/v1/events/evt-1');
    expect(request.attendees.path).toBe('/v1/events/evt-1/attendees');
    expect(request.reminders.path).toBe('/v1/events/evt-1/reminders');
    expect(request.event.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
    expect(request.attendees.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
    expect(request.reminders.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when organizer dev flow header is disabled', () => {
    const request = buildEventDetailsRequests({
      baseUrl: 'http://localhost:3000/api',
      eventId: 'evt-1',
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.event.headers).toBeUndefined();
    expect(request.attendees.headers).toBeUndefined();
    expect(request.reminders.headers).toBeUndefined();
  });

  it('bundles decoded event, attendees, and reminders into one typed response', async () => {
    const requestJson = vi.fn()
      .mockResolvedValueOnce(sampleEventResponse)
      .mockResolvedValueOnce(sampleAttendeesResponse)
      .mockResolvedValueOnce(sampleRemindersResponse);

    const bundle = await fetchOrganizerEventDetailsBundle(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt-1',
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestJson,
    );

    expect(requestJson).toHaveBeenCalledTimes(3);
    expect(bundle).toEqual({
      event: sampleEventResponse,
      attendees: sampleAttendeesResponse,
      reminders: sampleRemindersResponse,
    });
  });
});
