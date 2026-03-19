import { extractInviteToken, type InviteTokenParseResult } from './invite-token-parser';

export const validateInviteTokenEntry = (input: string): InviteTokenParseResult => extractInviteToken(input.trim());
