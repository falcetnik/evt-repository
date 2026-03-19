import { describe, expect, it, vi } from 'vitest';
import { buildReplaceEventRemindersRequest, replaceEventReminders } from './event-reminders';

const sampleResponse = {
  eventId: 'evt_123',
  startsAt: '2026-03-20T18:30:00.000Z',
  timezone: 'Europe/Moscow',
  reminders: [
    {
      reminderId: 'rem_1',
      offsetMinutes: 1440,
      sendAt: '2026-03-19T18:30:00.000Z',
    },
  ],
  total: 1,
};

describe('event reminders API helper', () => {
  it('builds PUT request to replace reminders and includes dev header when enabled', () => {
    const request = buildReplaceEventRemindersRequest({
      eventId: 'evt_123',
      offsetsMinutes: [1440, 120, 30],
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt_123/reminders');
    expect(request.method).toBe('PUT');
    expect(request.body).toEqual({ offsetsMinutes: [1440, 120, 30] });
    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when disabled', () => {
    const request = buildReplaceEventRemindersRequest({
      eventId: 'evt_123',
      offsetsMinutes: [],
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('calls requestJson and returns the typed reminders payload', async () => {
    const requestJson = vi.fn().mockResolvedValue(sampleResponse);

    const response = await replaceEventReminders(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt_123',
        offsetsMinutes: [1440, 120, 30],
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestJson,
    );

    expect(requestJson).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events/evt_123/reminders',
      method: 'PUT',
      body: { offsetsMinutes: [1440, 120, 30] },
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
    expect(response).toEqual(sampleResponse);
  });
});
