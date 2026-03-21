import { requestJson, type ApiRequestOptions } from './http';
import type { OrganizerInviteLink } from './invite-link';

export type EventCurrentInviteLinkResponse = {
  eventId: string;
  inviteLink: OrganizerInviteLink | null;
};

export type BuildGetCurrentInviteLinkRequestInput = {
  eventId: string;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildGetCurrentInviteLinkRequest = ({
  eventId,
  devUserId,
  includeDevUserHeader,
}: BuildGetCurrentInviteLinkRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}/invite-link`,
  method: 'GET',
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const getCurrentInviteLink = (
  params: {
    baseUrl: string;
    eventId: string;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<EventCurrentInviteLinkResponse> => {
  const request = buildGetCurrentInviteLinkRequest(params);

  return requestJsonFn<EventCurrentInviteLinkResponse>(params.baseUrl, request);
};
