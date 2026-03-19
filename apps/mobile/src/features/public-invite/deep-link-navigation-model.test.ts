import { describe, expect, it } from 'vitest';
import { resolvePublicInviteOpenIntent } from './deep-link-navigation-model';

describe('resolvePublicInviteOpenIntent', () => {
  it('maps a valid incoming invite URL to a deep-link navigation intent', () => {
    expect(resolvePublicInviteOpenIntent('eventapp://invite-links/abc123token')).toEqual({
      token: 'abc123token',
      origin: 'deep-link',
    });
  });

  it('returns null for invalid or unrelated links', () => {
    expect(resolvePublicInviteOpenIntent('eventapp://not-an-invite/path')).toBeNull();
    expect(resolvePublicInviteOpenIntent('https://example.com/api/v1/events/evt_123')).toBeNull();
  });

  it('always marks valid intents with deep-link origin', () => {
    expect(resolvePublicInviteOpenIntent('https://example.com/api/v1/invite-links/token-42')).toEqual({
      token: 'token-42',
      origin: 'deep-link',
    });
  });
});
