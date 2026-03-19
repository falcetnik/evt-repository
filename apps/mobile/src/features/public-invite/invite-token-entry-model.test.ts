import { describe, expect, it } from 'vitest';
import { validateInviteTokenEntry } from './invite-token-entry-model';

describe('invite token entry model', () => {
  it('returns success for valid raw token', () => {
    expect(validateInviteTokenEntry('abc123token')).toEqual({ ok: true, token: 'abc123token' });
  });

  it('returns success for valid full URL', () => {
    expect(validateInviteTokenEntry('https://example.com/api/v1/invite-links/abc123token')).toEqual({
      ok: true,
      token: 'abc123token',
    });
  });

  it('returns failure for invalid input', () => {
    expect(validateInviteTokenEntry('https://example.com/api/v1/events/abc123token')).toEqual({
      ok: false,
      message: 'That invite link is not valid.',
    });
  });

  it('returns a user-friendly error for whitespace-only input', () => {
    expect(validateInviteTokenEntry('   ')).toEqual({
      ok: false,
      message: 'Enter an invite token or full invite URL.',
    });
  });
});
