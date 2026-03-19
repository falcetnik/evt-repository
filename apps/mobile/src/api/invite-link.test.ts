import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './http';
import { buildCreateOrReuseInviteLinkRequest, createOrReuseInviteLink } from './invite-link';

describe('invite-link API helper', () => {
  it('builds POST request to event invite-link path and includes dev header when enabled', () => {
    const request = buildCreateOrReuseInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: true,
    });

    expect(request.path).toBe('/v1/events/evt-123/invite-link');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'x-dev-user-id': 'organizer-1' });
  });

  it('omits dev header when organizer dev header is disabled', () => {
    const request = buildCreateOrReuseInviteLinkRequest({
      eventId: 'evt-123',
      devUserId: 'organizer-1',
      includeDevUserHeader: false,
    });

    expect(request.headers).toBeUndefined();
  });

  it('returns invite-link response in typed shape', async () => {
    const inviteLink = {
      eventId: 'evt-123',
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      isActive: true,
      expiresAt: null,
      createdAt: '2026-03-20T10:00:00.000Z',
    };

    const requestJson = vi.fn().mockResolvedValue(inviteLink);

    const response = await createOrReuseInviteLink(
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
      method: 'POST',
      headers: { 'x-dev-user-id': 'organizer-1' },
    });
    expect(response).toEqual(inviteLink);
  });

  it('surfaces non-2xx HTTP failures from requestJson consistently', async () => {
    const requestJson = vi.fn().mockRejectedValue(new ApiClientError('http', 'Request failed with 500', 500));

    await expect(
      createOrReuseInviteLink(
        {
          baseUrl: 'http://localhost:3000/api',
          eventId: 'evt-123',
          devUserId: 'organizer-1',
          includeDevUserHeader: true,
        },
        requestJson,
      ),
    ).rejects.toMatchObject({ kind: 'http', status: 500 });
  });
});
