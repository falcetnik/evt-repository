import { requestJson, type ApiRequestOptions } from './http';

export type ReplaceEventRemindersResponse = {
  eventId: string;
  startsAt: string;
  timezone: string;
  reminders: Array<{
    reminderId: string;
    offsetMinutes: number;
    sendAt: string;
  }>;
  total: number;
};

export type BuildReplaceEventRemindersRequestInput = {
  eventId: string;
  offsetsMinutes: number[];
  devUserId: string;
  includeDevUserHeader: boolean;
};

export const buildReplaceEventRemindersRequest = ({
  eventId,
  offsetsMinutes,
  devUserId,
  includeDevUserHeader,
}: BuildReplaceEventRemindersRequestInput): ApiRequestOptions => ({
  path: `/v1/events/${eventId}/reminders`,
  method: 'PUT',
  body: { offsetsMinutes },
  headers: includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const replaceEventReminders = (
  params: {
    baseUrl: string;
    eventId: string;
    offsetsMinutes: number[];
    devUserId: string;
    includeDevUserHeader: boolean;
  },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<ReplaceEventRemindersResponse> => {
  const request = buildReplaceEventRemindersRequest({
    eventId: params.eventId,
    offsetsMinutes: params.offsetsMinutes,
    devUserId: params.devUserId,
    includeDevUserHeader: params.includeDevUserHeader,
  });

  return requestJsonFn<ReplaceEventRemindersResponse>(params.baseUrl, request);
};
