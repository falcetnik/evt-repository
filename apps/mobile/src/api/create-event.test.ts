import { describe, expect, it, vi } from 'vitest';
import { buildCreateEventRequest, createOrganizerEvent } from './create-event';

const samplePayload = {
  title: 'Friday Board Games',
  description: null,
  location: 'Prospekt Mira 10',
  startsAt: '2099-03-25T19:30:00.000Z',
  timezone: 'Europe/Moscow',
  capacityLimit: null,
};

describe('create event API helper', () => {
  it('builds POST request to /v1/events and preserves dev header behavior', () => {
    const request = buildCreateEventRequest({
      payload: samplePayload,
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
    expect(request.body).toEqual(samplePayload);
  });

  it('omits dev header when organizer dev header is disabled', () => {
    const request = buildCreateEventRequest({
      payload: samplePayload,
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('submits normalized payload to requestJson and returns created event', async () => {
    const createdEvent = {
      id: 'evt-123',
      title: 'Friday Board Games',
      description: null,
      location: 'Prospekt Mira 10',
      startsAt: '2099-03-25T19:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: null,
      organizerUserId: 'organizer-1',
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-01T00:00:00.000Z',
    };

    const requestJson = vi.fn().mockResolvedValue(createdEvent);

    const response = await createOrganizerEvent(
      {
        baseUrl: 'http://localhost:3000/api',
        payload: samplePayload,
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestJson,
    );

    expect(requestJson).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events',
      method: 'POST',
      body: samplePayload,
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
    expect(response).toEqual(createdEvent);
  });
});
