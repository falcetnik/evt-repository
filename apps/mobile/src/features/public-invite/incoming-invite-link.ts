const INVITE_LINKS_SEGMENT = 'invite-links';

const getPathSegments = (pathname: string): string[] => pathname.split('/').filter(Boolean);

const getTokenForInviteSegments = (segments: string[]): string | null => {
  const inviteSegmentIndex = segments.lastIndexOf(INVITE_LINKS_SEGMENT);

  if (inviteSegmentIndex === -1 || inviteSegmentIndex !== segments.length - 2) {
    return null;
  }

  const token = segments[inviteSegmentIndex + 1];
  return token ? token : null;
};

export function extractInviteTokenFromIncomingUrl(url: string): string | null {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const protocol = parsedUrl.protocol.toLowerCase();

    if (protocol === 'eventapp:') {
      const customSchemeSegments = [parsedUrl.host, ...getPathSegments(parsedUrl.pathname)].filter(Boolean);

      if (customSchemeSegments.length !== 2 || customSchemeSegments[0] !== INVITE_LINKS_SEGMENT) {
        return null;
      }

      return customSchemeSegments[1] || null;
    }

    if (protocol === 'exp:' || protocol === 'exps:') {
      const expoSegments = getPathSegments(parsedUrl.pathname);

      if (expoSegments.length !== 3 || expoSegments[0] !== '--' || expoSegments[1] !== INVITE_LINKS_SEGMENT) {
        return null;
      }

      return expoSegments[2] || null;
    }

    if (protocol === 'http:' || protocol === 'https:') {
      return getTokenForInviteSegments(getPathSegments(parsedUrl.pathname));
    }

    return null;
  } catch {
    return null;
  }
}
