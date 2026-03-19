import { requestJson } from './http';

export type EventListScope = 'upcoming' | 'past' | 'all';

export type OrganizerEventListItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  timezone: string;
  capacityLimit: number | null;
  summary: {
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
  hasActiveInviteLink: boolean;
  activeReminderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerEventsListResponse = {
  scope: EventListScope;
  total: number;
  events: OrganizerEventListItem[];
};

export type BuildEventsListRequestInput = {
  baseUrl: string;
  devUserId: string;
  scope: EventListScope;
};

export const parseEventsListScope = (value: string | undefined): EventListScope => {
  if (value === 'past' || value === 'all' || value === 'upcoming') {
    return value;
  }

  return 'upcoming';
};

export const buildEventsListRequest = ({ baseUrl, devUserId, scope }: BuildEventsListRequestInput) => {
  const base = baseUrl.replace(/\/+$/g, '');
  const url = new URL(`${base}/v1/events`);

  if (scope !== 'upcoming') {
    url.searchParams.set('scope', scope);
  }

  return {
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'x-dev-user-id': devUserId,
    },
  };
};

export const fetchOrganizerEvents = (params: {
  baseUrl: string;
  scope: EventListScope;
  devUserId: string;
  includeDevUserHeader: boolean;
}) => {
  return requestJson<OrganizerEventsListResponse>(params.baseUrl, {
    path: '/v1/events',
    query: params.scope === 'upcoming' ? undefined : { scope: params.scope },
    headers: params.includeDevUserHeader ? { 'x-dev-user-id': params.devUserId } : undefined,
  });
};
