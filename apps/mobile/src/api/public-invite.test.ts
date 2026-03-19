import { describe, expect, it, vi } from 'vitest';
import { buildGetPublicInviteRequest, buildSubmitPublicRsvpRequest, getPublicInvite, submitPublicRsvp } from './public-invite';

describe('public-invite API helper', () => {
  it('builds GET request path without organizer dev header', () => {
    const request = buildGetPublicInviteRequest({ token: 'abc123' });

    expect(request).toEqual({
      path: '/v1/invite-links/abc123',
      method: 'GET',
    });
  });

  it('builds RSVP POST request path/body without organizer dev header', () => {
    const request = buildSubmitPublicRsvpRequest({
      token: 'abc123',
      payload: {
        guestName: 'Nikita',
        guestEmail: 'nikita@example.com',
        status: 'going',
      },
    });

    expect(request).toEqual({
      path: '/v1/invite-links/abc123/rsvp',
      method: 'POST',
      body: {
        guestName: 'Nikita',
        guestEmail: 'nikita@example.com',
        status: 'going',
      },
    });
    expect(request.headers).toBeUndefined();
  });

  it('returns typed invite response passthrough', async () => {
    const responsePayload = {
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      expiresAt: null,
      event: {
        title: 'Friday Board Games',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 10',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
        allowPlusOnes: false,
      },
      rsvpSummary: {
        going: 3,
        maybe: 1,
        notGoing: 1,
        total: 5,
        confirmedGoing: 2,
        waitlistedGoing: 1,
        capacityLimit: 2,
        remainingSpots: 0,
        isFull: true,
      },
    };

    const requestJson = vi.fn().mockResolvedValue(responsePayload);

    const response = await getPublicInvite({ baseUrl: 'http://localhost:3000/api', token: 'abc123' }, requestJson);

    expect(requestJson).toHaveBeenCalledWith('http://localhost:3000/api', {
      path: '/v1/invite-links/abc123',
      method: 'GET',
    });
    expect(response).toEqual(responsePayload);
  });

  it('accepts RSVP success response when request resolves (HTTP 200/201)', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({ status: 'going', attendanceState: 'confirmed' })
      .mockResolvedValueOnce({ status: 'going', attendanceState: 'waitlisted' });

    const firstResponse = await submitPublicRsvp(
      {
        baseUrl: 'http://localhost:3000/api',
        token: 'abc123',
        payload: { guestName: 'Nikita', guestEmail: 'nikita@example.com', status: 'going' },
      },
      requestJson,
    );

    const secondResponse = await submitPublicRsvp(
      {
        baseUrl: 'http://localhost:3000/api',
        token: 'abc123',
        payload: { guestName: 'Nikita', guestEmail: 'nikita@example.com', status: 'going' },
      },
      requestJson,
    );

    expect(firstResponse).toMatchObject({ status: 'going', attendanceState: 'confirmed' });
    expect(secondResponse).toMatchObject({ status: 'going', attendanceState: 'waitlisted' });
  });
});
