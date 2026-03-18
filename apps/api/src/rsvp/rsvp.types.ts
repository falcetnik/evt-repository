import { AttendeeResponseStatus } from '@prisma/client';

export type PublicRsvpStatus = 'going' | 'maybe' | 'not_going';

export type RsvpSummary = {
  going: number;
  maybe: number;
  notGoing: number;
  total: number;
};

export const RSVP_STATUS_TO_DB: Record<PublicRsvpStatus, AttendeeResponseStatus> = {
  going: AttendeeResponseStatus.GOING,
  maybe: AttendeeResponseStatus.MAYBE,
  not_going: AttendeeResponseStatus.NOT_GOING,
};

export const DB_TO_RSVP_STATUS: Record<AttendeeResponseStatus, PublicRsvpStatus> = {
  [AttendeeResponseStatus.GOING]: 'going',
  [AttendeeResponseStatus.MAYBE]: 'maybe',
  [AttendeeResponseStatus.NOT_GOING]: 'not_going',
  [AttendeeResponseStatus.WAITLIST]: 'maybe',
};

export function toSummary(statuses: AttendeeResponseStatus[]): RsvpSummary {
  const summary: RsvpSummary = {
    going: 0,
    maybe: 0,
    notGoing: 0,
    total: statuses.length,
  };

  for (const status of statuses) {
    if (status === AttendeeResponseStatus.GOING) {
      summary.going += 1;
    } else if (status === AttendeeResponseStatus.MAYBE) {
      summary.maybe += 1;
    } else if (status === AttendeeResponseStatus.NOT_GOING) {
      summary.notGoing += 1;
    }
  }

  return summary;
}
