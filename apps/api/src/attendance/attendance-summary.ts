import { AttendeeResponseStatus } from '@prisma/client';

export type AttendanceState = 'confirmed' | 'waitlisted' | 'not_attending';

type AttendeePlacementInput = {
  id: string;
  responseStatus: AttendeeResponseStatus;
  waitlistPosition: number | null;
  createdAt: Date;
};

export function deriveAttendanceState(
  responseStatus: AttendeeResponseStatus,
  waitlistPosition: number | null,
): AttendanceState {
  if (responseStatus !== AttendeeResponseStatus.GOING) {
    return 'not_attending';
  }

  if (waitlistPosition !== null) {
    return 'waitlisted';
  }

  return 'confirmed';
}

export function buildRsvpSummary(
  attendees: Array<{ responseStatus: AttendeeResponseStatus; waitlistPosition: number | null }>,
  capacityLimit: number | null,
) {
  const summary = {
    going: 0,
    maybe: 0,
    notGoing: 0,
    total: attendees.length,
    confirmedGoing: 0,
    waitlistedGoing: 0,
    capacityLimit,
    remainingSpots: 0,
    isFull: false,
  };

  for (const attendee of attendees) {
    if (attendee.responseStatus === AttendeeResponseStatus.GOING) {
      summary.going += 1;
      if (attendee.waitlistPosition === null) {
        summary.confirmedGoing += 1;
      } else {
        summary.waitlistedGoing += 1;
      }
    } else if (attendee.responseStatus === AttendeeResponseStatus.MAYBE) {
      summary.maybe += 1;
    } else if (attendee.responseStatus === AttendeeResponseStatus.NOT_GOING) {
      summary.notGoing += 1;
    }
  }

  if (capacityLimit === null) {
    summary.remainingSpots = 0;
    summary.isFull = false;
  } else {
    summary.remainingSpots = Math.max(capacityLimit - summary.confirmedGoing, 0);
    summary.isFull = summary.remainingSpots === 0;
  }

  return summary;
}

export function sortAttendeesForOrganizer<T extends AttendeePlacementInput>(attendees: T[]): T[] {
  return [...attendees].sort((left, right) => {
    const leftState = deriveAttendanceState(left.responseStatus, left.waitlistPosition);
    const rightState = deriveAttendanceState(right.responseStatus, right.waitlistPosition);

    const rank = (state: AttendanceState, responseStatus: AttendeeResponseStatus) => {
      if (state === 'confirmed') {
        return 0;
      }
      if (state === 'waitlisted') {
        return 1;
      }
      if (responseStatus === AttendeeResponseStatus.MAYBE) {
        return 2;
      }
      return 3;
    };

    const leftRank = rank(leftState, left.responseStatus);
    const rightRank = rank(rightState, right.responseStatus);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (leftState === 'waitlisted' && rightState === 'waitlisted') {
      if (left.waitlistPosition !== right.waitlistPosition) {
        return (left.waitlistPosition ?? 0) - (right.waitlistPosition ?? 0);
      }
      return left.id.localeCompare(right.id);
    }

    if (left.createdAt.getTime() !== right.createdAt.getTime()) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }

    return left.id.localeCompare(right.id);
  });
}
