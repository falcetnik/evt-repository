import { requestJson, type ApiRequestOptions } from './http';

export type OrganizerInviteLink = {
  eventId: string;
  token: string;
  url: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export type BuildCreateOrReuseInviteLinkRequestInput = {
  eventId: string;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildCreateOrReuseInviteLinkRequest = ({
  eventId,
  devUserId,
  includeDevUserHeader,
}: BuildCreateOrReuseInviteLinkRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}/invite-link`,
  method: 'POST',
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const createOrReuseInviteLink = (
  params: {
    baseUrl: string;
    eventId: string;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<OrganizerInviteLink> => {
  const request = buildCreateOrReuseInviteLinkRequest(params);

  return requestJsonFn<OrganizerInviteLink>(params.baseUrl, request);
};
