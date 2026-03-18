import { buildInviteUrl } from '../src/invite-links/invite-link-url';

describe('buildInviteUrl', () => {
  it('joins base URL and token into expected invite URL', () => {
    expect(buildInviteUrl('http://localhost:3000/api/v1/invite-links', 'abc_123-token')).toBe(
      'http://localhost:3000/api/v1/invite-links/abc_123-token',
    );
  });

  it('normalizes trailing slash in base URL', () => {
    expect(buildInviteUrl('http://localhost:3000/api/v1/invite-links/', 'token-xyz')).toBe(
      'http://localhost:3000/api/v1/invite-links/token-xyz',
    );
  });
});
