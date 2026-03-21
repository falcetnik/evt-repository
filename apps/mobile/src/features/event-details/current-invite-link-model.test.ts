import { describe, expect, it } from 'vitest';
import { buildCurrentInviteLinkSectionState } from './current-invite-link-model';

describe('current invite-link section state model', () => {
  it('returns loading state while current invite-link fetch is in progress', () => {
    expect(buildCurrentInviteLinkSectionState({ isLoading: true })).toEqual({
      status: 'loading',
      message: 'Loading invite link...',
      inviteLink: null,
    });
  });

  it('returns empty state when fetch succeeds with inviteLink null', () => {
    expect(
      buildCurrentInviteLinkSectionState({
        isLoading: false,
        response: {
          eventId: 'evt-123',
          inviteLink: null,
        },
      }),
    ).toEqual({
      status: 'empty',
      message: 'No active invite link yet.',
      inviteLink: null,
    });
  });

  it('returns success state when fetch succeeds with invite link payload', () => {
    const inviteLink = {
      eventId: 'evt-123',
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      isActive: true,
      expiresAt: null,
      createdAt: '2026-03-20T10:00:00.000Z',
    };

    expect(
      buildCurrentInviteLinkSectionState({
        isLoading: false,
        response: {
          eventId: 'evt-123',
          inviteLink,
        },
      }),
    ).toEqual({
      status: 'success',
      message: null,
      inviteLink,
    });
  });

  it('returns error state and fallback message when current fetch fails', () => {
    expect(
      buildCurrentInviteLinkSectionState({
        isLoading: false,
        errorMessage: null,
      }),
    ).toEqual({
      status: 'error',
      message: 'Could not load invite link.',
      inviteLink: null,
    });
  });
});
