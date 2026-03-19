import { requestJson, type ApiRequestOptions } from './http';

export type PublicInviteResponse = {
  token: string;
  url: string;
  expiresAt: string | null;
  event: {
    title: string;
    description: string | null;
    location: string | null;
    startsAt: string;
    timezone: string;
    capacityLimit: number | null;
    allowPlusOnes: boolean;
  };
  rsvpSummary: {
    going: number;
    maybe: number;
    notGoing: number;
    total: number;
    confirmedGoing: number;
    waitlistedGoing: number;
    capacityLimit: number | null;
    remainingSpots: number | null;
    isFull: boolean;
  };
};

export type PublicRsvpStatus = 'going' | 'maybe' | 'not_going';

export type SubmitPublicRsvpPayload = {
  guestName: string;
  guestEmail: string;
  status: PublicRsvpStatus;
};

export type SubmitPublicRsvpResponse = {
  attendeeId: string;
  eventId: string;
  guestName: string;
  guestEmail: string;
  status: PublicRsvpStatus;
  attendanceState: 'confirmed' | 'waitlisted' | 'not_attending';
  waitlistPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

export const buildGetPublicInviteRequest = ({ token }: { token: string }): ApiRequestOptions => ({
  path: `/v1/invite-links/${token}`,
  method: 'GET',
});

export const buildSubmitPublicRsvpRequest = ({
  token,
  payload,
}: {
  token: string;
  payload: SubmitPublicRsvpPayload;
}): ApiRequestOptions => ({
  path: `/v1/invite-links/${token}/rsvp`,
  method: 'POST',
  body: payload,
});

type RequestJsonFn = <TResponse>(baseUrl: string, options: ApiRequestOptions) => Promise<TResponse>;

export const getPublicInvite = (
  params: { baseUrl: string; token: string },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<PublicInviteResponse> => {
  const request = buildGetPublicInviteRequest(params);
  return requestJsonFn<PublicInviteResponse>(params.baseUrl, request);
};

export const submitPublicRsvp = (
  params: { baseUrl: string; token: string; payload: SubmitPublicRsvpPayload },
  requestJsonFn: RequestJsonFn = requestJson,
): Promise<SubmitPublicRsvpResponse> => {
  const request = buildSubmitPublicRsvpRequest(params);
  return requestJsonFn<SubmitPublicRsvpResponse>(params.baseUrl, request);
};
