import { requestJson, type ApiRequestOptions } from './http';

export type OrganizerEventDetailsResponse = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  timezone: string;
  capacityLimit: number | null;
  organizerUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerEventAttendeesResponse = {
  eventId: string;
  summary: {
    total: number;
    going: number;
    maybe: number;
    notGoing: number;
    confirmedGoing: number;
    waitlistedGoing: number;
    capacityLimit: number | null;
    remainingSpots: number | null;
    isFull: boolean;
  };
  attendees: Array<{
    attendeeId: string;
    guestName: string;
    guestEmail: string;
    status: 'going' | 'maybe' | 'not_going';
    attendanceState: 'confirmed' | 'waitlisted' | 'not_attending';
    waitlistPosition: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type OrganizerEventRemindersResponse = {
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

export type OrganizerEventDetailsBundle = {
  event: OrganizerEventDetailsResponse;
  attendees: OrganizerEventAttendeesResponse;
  reminders: OrganizerEventRemindersResponse;
};

export type BuildEventDetailsRequestsInput = {
  baseUrl: string;
  eventId: string;
  devUserId: string;
  includeDevUserHeader: boolean;
};

const buildDevHeaders = (devUserId: string, includeDevUserHeader: boolean) =>
  includeDevUserHeader ? { 'x-dev-user-id': devUserId } : undefined;

export const buildEventDetailsRequests = ({
  eventId,
  devUserId,
  includeDevUserHeader,
}: BuildEventDetailsRequestsInput): {
  event: ApiRequestOptions;
  attendees: ApiRequestOptions;
  reminders: ApiRequestOptions;
} => {
  const headers = buildDevHeaders(devUserId, includeDevUserHeader);

  return {
    event: {
      path: `/v1/events/${eventId}`,
      headers,
    },
    attendees: {
      path: `/v1/events/${eventId}/attendees`,
      headers,
    },
    reminders: {
      path: `/v1/events/${eventId}/reminders`,
      headers,
    },
  };
};

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const fetchOrganizerEventDetailsBundle = async (
  params: BuildEventDetailsRequestsInput,
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<OrganizerEventDetailsBundle> => {
  const requests = buildEventDetailsRequests(params);

  const [event, attendees, reminders] = await Promise.all([
    requestJsonFn<OrganizerEventDetailsResponse>(params.baseUrl, requests.event),
    requestJsonFn<OrganizerEventAttendeesResponse>(params.baseUrl, requests.attendees),
    requestJsonFn<OrganizerEventRemindersResponse>(params.baseUrl, requests.reminders),
  ]);

  return {
    event,
    attendees,
    reminders,
  };
};
