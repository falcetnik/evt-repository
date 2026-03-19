import { describe, expect, it, vi } from 'vitest';
import { buildUpdateEventRequest, updateOrganizerEvent } from './update-event';

const samplePayload = {
  title: 'Friday Board Games Updated',
  description: null,
  location: 'Prospekt Mira 11',
  startsAt: '2099-03-26T19:30:00.000Z',
  timezone: 'Europe/Moscow',
  capacityLimit: 10,
};

describe('update event API helper', () => {
  it('builds PATCH request to /v1/events/:eventId with request body passthrough', () => {
    const request = buildUpdateEventRequest({
      eventId: 'evt-123',
      payload: samplePayload,
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt-123');
    expect(request.method).toBe('PATCH');
    expect(request.body).toEqual(samplePayload);
  });

  it('includes dev header when enabled', () => {
    const request = buildUpdateEventRequest({
      eventId: 'evt-123',
      payload: samplePayload,
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when disabled', () => {
    const request = buildUpdateEventRequest({
      eventId: 'evt-123',
      payload: samplePayload,
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('returns typed response passthrough', async () => {
    const updatedEvent = {
      id: 'evt-123',
      title: 'Friday Board Games Updated',
      description: null,
      location: 'Prospekt Mira 11',
      startsAt: '2099-03-26T19:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: 10,
      organizerUserId: 'organizer-1',
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-02T00:00:00.000Z',
    };

    const requestJson = vi.fn().mockResolvedValue(updatedEvent);

    const response = await updateOrganizerEvent(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt-123',
        payload: samplePayload,
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestJson,
    );

    expect(requestJson).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events/evt-123',
      method: 'PATCH',
      body: samplePayload,
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
    expect(response).toEqual(updatedEvent);
  });
});
