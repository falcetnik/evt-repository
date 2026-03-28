import { describe, expect, it, vi } from 'vitest';
import {
  buildDeleteEventRequest,
  deleteOrganizerEvent,
  type RequestNoContentFn,
} from './delete-event';

describe('delete event API helper', () => {
  it('builds DELETE request to /v1/events/:eventId', () => {
    const request = buildDeleteEventRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt-123');
    expect(request.method).toBe('DELETE');
  });

  it('includes dev header when enabled', () => {
    const request = buildDeleteEventRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when disabled', () => {
    const request = buildDeleteEventRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('calls DELETE /v1/events/:eventId', async () => {
    const requestNoContent: RequestNoContentFn = vi.fn().mockResolvedValue(undefined);

    await deleteOrganizerEvent(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt-123',
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestNoContent,
    );

    expect(requestNoContent).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events/evt-123',
      method: 'DELETE',
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
  });

  it('treats 204 no-content response as success', async () => {
    const requestNoContent: RequestNoContentFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      deleteOrganizerEvent(
        {
          baseUrl: 'http://localhost:3000/api',
          eventId: 'evt-123',
          devUserId: 'organizer-1',
          includeDevUserHeader: false,
        },
        requestNoContent,
      ),
    ).resolves.toBeUndefined();
  });
});
