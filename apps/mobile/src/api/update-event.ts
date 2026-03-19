import type { OrganizerEventDetailsResponse } from './event-details';
import { requestJson, type ApiRequestOptions } from './http';

export type UpdateEventInput = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startsAt?: string;
  timezone?: string;
  capacityLimit?: number | null;
};

export type UpdateEventResponse = OrganizerEventDetailsResponse;

export type BuildUpdateEventRequestInput = {
  eventId: string;
  payload: UpdateEventInput;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildUpdateEventRequest = ({
  eventId,
  payload,
  devUserId,
  includeDevUserHeader,
}: BuildUpdateEventRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}`,
  method: 'PATCH',
  body: payload,
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const updateOrganizerEvent = (
  params: {
    baseUrl: string;
    eventId: string;
    payload: UpdateEventInput;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<UpdateEventResponse> => {
  const request = buildUpdateEventRequest({
    eventId: params.eventId,
    payload: params.payload,
    devUserId: params.devUserId,
    includeDevUserHeader: params.includeDevUserHeader,
  });

  return requestJsonFn<UpdateEventResponse>(params.baseUrl, request);
};
