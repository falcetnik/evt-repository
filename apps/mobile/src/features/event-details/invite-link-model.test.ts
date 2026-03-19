import { describe, expect, it } from 'vitest';
import { mapInviteLinkToViewModel } from './invite-link-model';

describe('invite-link view model mapper', () => {
  it('maps URL and token to UI-friendly labels with active status', () => {
    const model = mapInviteLinkToViewModel({
      eventId: 'evt-123',
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      isActive: true,
      expiresAt: null,
      createdAt: '2026-03-20T10:00:00.000Z',
    });

    expect(model.urlLabel).toBe('URL: http://localhost:3000/api/v1/invite-links/abc123');
    expect(model.tokenLabel).toBe('Token: abc123');
    expect(model.expiresAtLabel).toBe('Expires: No expiry');
    expect(model.statusLabel).toBe('Status: Active');
  });

  it('maps non-null expiry to deterministic display text', () => {
    const model = mapInviteLinkToViewModel({
      eventId: 'evt-123',
      token: 'abc123',
      url: 'http://localhost:3000/api/v1/invite-links/abc123',
      isActive: false,
      expiresAt: '2026-04-01T10:00:00.000Z',
      createdAt: '2026-03-20T10:00:00.000Z',
    });

    expect(model.expiresAtLabel).toBe('Expires: 2026-04-01T10:00:00Z');
    expect(model.statusLabel).toBe('Status: Expired');
  });

  it('returns deterministic empty-state labels', () => {
    expect(mapInviteLinkToViewModel(null)).toEqual({
      stateLabel: 'Invite link not created yet',
      urlLabel: null,
      tokenLabel: null,
      expiresAtLabel: null,
      statusLabel: null,
    });
  });

  it('returns deterministic error label text', () => {
    expect(mapInviteLinkToViewModel(null, 'Request failed with 500')).toEqual({
      stateLabel: 'Could not load invite link: Request failed with 500',
      urlLabel: null,
      tokenLabel: null,
      expiresAtLabel: null,
      statusLabel: null,
    });
  });
});
