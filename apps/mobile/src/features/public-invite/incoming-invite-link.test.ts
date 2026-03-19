import { describe, expect, it } from 'vitest';
import { extractInviteTokenFromIncomingUrl } from './incoming-invite-link';

describe('extractInviteTokenFromIncomingUrl', () => {
  it('parses custom-scheme deep links', () => {
    expect(extractInviteTokenFromIncomingUrl('eventapp://invite-links/abc123token')).toBe('abc123token');
  });

  it('parses Expo Go exp/exps deep links with /--/ path', () => {
    expect(extractInviteTokenFromIncomingUrl('exp://127.0.0.1:8081/--/invite-links/abc123token')).toBe('abc123token');
    expect(extractInviteTokenFromIncomingUrl('exps://192.168.0.10:8081/--/invite-links/xyz987')).toBe('xyz987');
  });

  it('parses absolute http(s) invite URLs', () => {
    expect(extractInviteTokenFromIncomingUrl('https://example.com/invite-links/abc123token')).toBe('abc123token');
    expect(extractInviteTokenFromIncomingUrl('http://localhost:3000/api/v1/invite-links/abc123token')).toBe('abc123token');
  });

  it('ignores query and hash fragments', () => {
    expect(extractInviteTokenFromIncomingUrl('exp://127.0.0.1:8081/--/invite-links/abc123token?foo=bar#hash')).toBe(
      'abc123token',
    );
  });

  it('rejects unsupported and malformed URLs safely', () => {
    expect(extractInviteTokenFromIncomingUrl('eventapp://not-an-invite/path')).toBeNull();
    expect(extractInviteTokenFromIncomingUrl('https://example.com/events/abc123token')).toBeNull();
    expect(extractInviteTokenFromIncomingUrl('https://exa mple.com/invite-links/abc123token')).toBeNull();
    expect(extractInviteTokenFromIncomingUrl('eventapp://invite-links/')).toBeNull();
    expect(extractInviteTokenFromIncomingUrl('')).toBeNull();
  });
});
