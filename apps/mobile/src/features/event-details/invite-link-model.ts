import type { OrganizerInviteLink } from '../../api/invite-link';

export type InviteLinkViewModel = {
  stateLabel: string;
  urlLabel: string | null;
  tokenLabel: string | null;
  expiresAtLabel: string | null;
  statusLabel: string | null;
};

const toIsoLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('.000Z', 'Z');
};

export const mapInviteLinkToViewModel = (
  inviteLink: OrganizerInviteLink | null,
  errorMessage?: string | null,
): InviteLinkViewModel => {
  if (errorMessage) {
    return {
      stateLabel: `Could not load invite link: ${errorMessage}`,
      urlLabel: null,
      tokenLabel: null,
      expiresAtLabel: null,
      statusLabel: null,
    };
  }

  if (!inviteLink) {
    return {
      stateLabel: 'Invite link not created yet',
      urlLabel: null,
      tokenLabel: null,
      expiresAtLabel: null,
      statusLabel: null,
    };
  }

  return {
    stateLabel: 'Invite link ready',
    urlLabel: `URL: ${inviteLink.url}`,
    tokenLabel: `Token: ${inviteLink.token}`,
    expiresAtLabel: `Expires: ${inviteLink.expiresAt ? toIsoLabel(inviteLink.expiresAt) : 'No expiry'}`,
    statusLabel: `Status: ${inviteLink.isActive ? 'Active' : 'Expired'}`,
  };
};
