import { extractInviteTokenFromIncomingUrl } from './incoming-invite-link';

export type PublicInviteOpenIntent = {
  token: string;
  origin: 'deep-link';
};

export function resolvePublicInviteOpenIntent(url: string): PublicInviteOpenIntent | null {
  const token = extractInviteTokenFromIncomingUrl(url);

  if (!token) {
    return null;
  }

  return {
    token,
    origin: 'deep-link',
  };
}
