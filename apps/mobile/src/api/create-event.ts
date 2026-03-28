import { requestJson, type ApiRequestOptions } from './http';

export type CreateEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  timezone: string;
  capacityLimit?: number | null;
  allowPlusOnes: boolean;
};

export type CreateEventResponse = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  timezone: string;
  capacityLimit: number | null;
  allowPlusOnes: boolean;
  organizerUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type BuildCreateEventRequestInput = {
  payload: CreateEventInput;
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildCreateEventRequest = ({
  payload,
  devUserId,
  includeDevUserHeader,
}: BuildCreateEventRequestInput): ApiRequestOptions => ({
  path: '/v1/events',
  method: 'POST',
  body: payload,
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const createOrganizerEvent = (
  params: {
    baseUrl: string;
    payload: CreateEventInput;
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<CreateEventResponse> => {
  const request = buildCreateEventRequest({
    payload: params.payload,
    devUserId: params.devUserId,
    includeDevUserHeader: params.includeDevUserHeader,
  });

  return requestJsonFn<CreateEventResponse>(params.baseUrl, request);
};
