import { describe, expect, it, vi } from 'vitest';
import {
  buildGetCurrentInviteLinkRequest,
  getCurrentInviteLink,
  type EventCurrentInviteLinkResponse,
} from './event-current-invite-link';

describe('event-current-invite-link API helper', () => {
  it('builds GET request to current event invite-link path with dev header when enabled', () => {
    const request = buildGetCurrentInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt-123/invite-link');
    expect(request.method).toBe('GET');
    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when organizer dev header is disabled', () => {
    const request = buildGetCurrentInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('returns nullable invite-link response unchanged', async () => {
    const responsePayload: EventCurrentInviteLinkResponse = {
      eventId: 'evt-123',
      inviteLink: null,
    };

    const requestJson = vi.fn().mockResolvedValue(responsePayload);

    const response = await getCurrentInviteLink(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt-123',
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestJson,
    );

    expect(requestJson).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events/evt-123/invite-link',
      method: 'GET',
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
    expect(response).toEqual(responsePayload);
  });
});
