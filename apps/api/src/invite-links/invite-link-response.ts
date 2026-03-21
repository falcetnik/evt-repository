import { buildInviteUrl } from './invite-link-url';

export function toOrganizerInviteLinkResponse(
  link: {
    eventId: string;
    token: string;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  },
  inviteBaseUrl: string,
) {
  return {
    eventId: link.eventId,
    token: link.token,
    url: buildInviteUrl(inviteBaseUrl, link.token),
    isActive: link.isActive,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  };
}
