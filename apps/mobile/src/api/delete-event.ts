import type { ApiRequestOptions } from './http';
import { requestNoContent } from './revoke-invite-link';
export type { RequestNoContentFn } from './revoke-invite-link';
import type { RequestNoContentFn } from './revoke-invite-link';

export type BuildDeleteEventRequestInput = {
  eventId: string;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildDeleteEventRequest = ({
  eventId,
  devUserId,
  includeDevUserHeader,
}: BuildDeleteEventRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}`,
  method: 'DELETE',
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

export const deleteOrganizerEvent = (
  params: {
    baseUrl: string;
    eventId: string;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestNoContentFn: RequestNoContentFn = requestNoContent,
): Promise<void> => {
  const request = buildDeleteEventRequest({
    eventId: params.eventId,
    devUserId: params.devUserId,
    includeDevUserHeader: params.includeDevUserHeader,
  });

  return requestNoContentFn(params.baseUrl, request);
};
