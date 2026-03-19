export type InviteTokenParseResult = { ok: true; token: string } | { ok: false; message: string };

const EMPTY_INPUT_MESSAGE = 'Enter an invite token or full invite URL.';
const INVALID_INVITE_MESSAGE = 'That invite link is not valid.';

const buildInvalidResult = (message = INVALID_INVITE_MESSAGE): InviteTokenParseResult => ({
  ok: false,
  message,
});

export const extractInviteToken = (input: string): InviteTokenParseResult => {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return buildInvalidResult(EMPTY_INPUT_MESSAGE);
  }

  if (trimmedInput.includes(' ')) {
    return buildInvalidResult();
  }

  const isHttpLikeInput = trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://');

  if (!isHttpLikeInput) {
    return { ok: true, token: trimmedInput };
  }

  try {
    const parsedUrl = new URL(trimmedInput);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const inviteLinksIndex = segments.lastIndexOf('invite-links');

    if (inviteLinksIndex === -1 || inviteLinksIndex !== segments.length - 2) {
      return buildInvalidResult();
    }

    const token = segments[inviteLinksIndex + 1];

    if (!token) {
      return buildInvalidResult();
    }

    return { ok: true, token };
  } catch {
    return buildInvalidResult();
  }
};
