import { ApiClientError, type ApiRequestOptions } from './http';

export type BuildRevokeCurrentInviteLinkRequestInput = {
  eventId: string;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildRevokeCurrentInviteLinkRequest = ({
  eventId,
  devUserId,
  includeDevUserHeader,
}: BuildRevokeCurrentInviteLinkRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}/invite-link`,
  method: 'DELETE',
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

export type RequestNoContentFn = (baseUrl: string, options: ApiRequestOptions) => Promise<void>;

export const requestNoContent: RequestNoContentFn = async (baseUrl, options) => {
  const method = options.method ?? 'GET';
  const url = new URL(options.path.replace(/^\/+/, ''), `${baseUrl}/`).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...options.headers,
      },
    });
  } catch (error) {
    throw new ApiClientError(
      'network',
      error instanceof Error ? error.message : 'Network request failed unexpectedly',
    );
  }

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new ApiClientError('http', `Request failed with ${response.status} ${statusText}`, response.status);
  }
};

export const revokeCurrentInviteLink = (
  params: {
    baseUrl: string;
    eventId: string;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestNoContentFn: RequestNoContentFn = requestNoContent,
): Promise<void> => {
  const request = buildRevokeCurrentInviteLinkRequest({
    eventId: params.eventId,
    devUserId: params.devUserId,
    includeDevUserHeader: params.includeDevUserHeader,
  });

  return requestNoContentFn(params.baseUrl, request);
};
