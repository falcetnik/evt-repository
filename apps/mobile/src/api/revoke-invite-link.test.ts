import { describe, expect, it, vi } from 'vitest';
import {
  buildRevokeCurrentInviteLinkRequest,
  revokeCurrentInviteLink,
  type RequestNoContentFn,
} from './revoke-invite-link';

describe('revoke current invite-link API helper', () => {
  it('builds DELETE request to current event invite-link path with dev header when enabled', () => {
    const request = buildRevokeCurrentInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt-123/invite-link');
    expect(request.method).toBe('DELETE');
    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when organizer dev header is disabled', () => {
    const request = buildRevokeCurrentInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('calls DELETE method against the current invite-link endpoint', async () => {
    const requestNoContent: RequestNoContentFn = vi.fn().mockResolvedValue(undefined);

    await revokeCurrentInviteLink(
      {
        baseUrl: 'http://localhost:3000/api',
        eventId: 'evt-123',
        devUserId: 'organizer-1',
        includeDevUserHeader: true,
      },
      requestNoContent,
    );

    expect(requestNoContent).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/events/evt-123/invite-link',
      method: 'DELETE',
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
  });

  it('treats 204 no-content response as success', async () => {
    const requestNoContent: RequestNoContentFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      revokeCurrentInviteLink(
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
