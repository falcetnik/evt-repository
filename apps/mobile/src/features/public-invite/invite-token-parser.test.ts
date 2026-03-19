import { describe, expect, it } from 'vitest';
import { extractInviteToken } from './invite-token-parser';

describe('invite token parser', () => {
  it('accepts a raw token', () => {
    expect(extractInviteToken('abc123token')).toEqual({ ok: true, token: 'abc123token' });
  });

  it('accepts a full invite URL', () => {
    expect(extractInviteToken('https://example.com/api/v1/invite-links/abc123token')).toEqual({
      ok: true,
      token: 'abc123token',
    });
  });

  it('accepts a full invite URL with query and hash', () => {
    expect(extractInviteToken('https://example.com/api/v1/invite-links/abc123token?utm=1#section')).toEqual({
      ok: true,
      token: 'abc123token',
    });
  });

  it('trims input before parsing', () => {
    expect(extractInviteToken('   https://example.com/api/v1/invite-links/abc123token   ')).toEqual({
      ok: true,
      token: 'abc123token',
    });
  });

  it('rejects empty input', () => {
    expect(extractInviteToken('   ')).toEqual({ ok: false, message: 'Enter an invite token or full invite URL.' });
  });

  it('rejects malformed URLs', () => {
    expect(extractInviteToken('https://exa mple.com/api/v1/invite-links/abc123token')).toEqual({
      ok: false,
      message: 'That invite link is not valid.',
    });
  });

  it('rejects URLs without an /invite-links/:token pathname', () => {
    expect(extractInviteToken('https://example.com/api/v1/events/abc123token')).toEqual({
      ok: false,
      message: 'That invite link is not valid.',
    });
  });

  it('rejects URLs with an empty invite token', () => {
    expect(extractInviteToken('https://example.com/api/v1/invite-links/')).toEqual({
      ok: false,
      message: 'That invite link is not valid.',
    });
  });

  it('rejects raw tokens containing spaces', () => {
    expect(extractInviteToken('abc 123 token')).toEqual({ ok: false, message: 'That invite link is not valid.' });
  });
});
