import { randomUUID } from 'crypto';

export function resolveRequestId(rawRequestId: string | string[] | undefined): string {
  const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
  if (requestId && requestId.trim().length > 0) {
    return requestId.trim();
  }

  return randomUUID();
}
