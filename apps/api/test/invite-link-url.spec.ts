import { buildInviteUrl } from '../src/invite-links/invite-link-url';

describe('buildInviteUrl', () => {
  it('joins base URL and token', () => {
    expect(buildInviteUrl('http://localhost:3000/api/v1/invite-links', 'abc123_token')).toBe(
      'http://localhost:3000/api/v1/invite-links/abc123_token',
    );
  });

  it('avoids double slash when base URL has trailing slash', () => {
    expect(buildInviteUrl('http://localhost:3000/api/v1/invite-links/', 'abc123_token')).toBe(
      'http://localhost:3000/api/v1/invite-links/abc123_token',
    );
  });
});
