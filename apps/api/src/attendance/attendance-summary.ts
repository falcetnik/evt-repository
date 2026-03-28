import { AttendeeResponseStatus } from '@prisma/client';

export type AttendanceState = 'confirmed' | 'waitlisted' | 'not_attending';

type AttendeePlacementInput = {
  id: string;
  responseStatus: AttendeeResponseStatus;
  waitlistPosition: number | null;
  createdAt: Date;
  plusOnesCount: number;
};

type AttendeeSummaryInput = Pick<AttendeePlacementInput, 'responseStatus' | 'waitlistPosition' | 'plusOnesCount'>;

export function getGoingHeadcount(plusOnesCount: number): number {
  return 1 + plusOnesCount;
}

export function buildGoingWaitlistPlacement<T extends AttendeePlacementInput>(
  attendees: readonly T[],
  capacityLimit: number | null,
) {
  const goingAttendees = attendees
    .filter((attendee) => attendee.responseStatus === AttendeeResponseStatus.GOING)
    .sort((left, right) => {
      if (left.createdAt.getTime() !== right.createdAt.getTime()) {
        return left.createdAt.getTime() - right.createdAt.getTime();
      }

      return left.id.localeCompare(right.id);
    });

  const nextWaitlistPositionById = new Map<string, number | null>();
  for (const attendee of attendees) {
    if (attendee.responseStatus !== AttendeeResponseStatus.GOING) {
      nextWaitlistPositionById.set(attendee.id, null);
    }
  }

  if (capacityLimit === null) {
    for (const attendee of goingAttendees) {
      nextWaitlistPositionById.set(attendee.id, null);
    }
    return nextWaitlistPositionById;
  }

  let usedHeadcount = 0;
  let waitlistPosition = 1;
  for (const attendee of goingAttendees) {
    const headcount = getGoingHeadcount(attendee.plusOnesCount);
    if (usedHeadcount + headcount <= capacityLimit) {
      nextWaitlistPositionById.set(attendee.id, null);
      usedHeadcount += headcount;
    } else {
      nextWaitlistPositionById.set(attendee.id, waitlistPosition);
      waitlistPosition += 1;
    }
  }

  return nextWaitlistPositionById;
}

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

export function buildRsvpSummary<T extends AttendeeSummaryInput>(
  attendees: readonly T[],
  capacityLimit: number | null,
) {
  const summary = {
    going: 0,
    maybe: 0,
    notGoing: 0,
    total: attendees.length,
    confirmedGoing: 0,
    waitlistedGoing: 0,
    goingHeadcount: 0,
    confirmedHeadcount: 0,
    waitlistedHeadcount: 0,
    capacityLimit,
    remainingSpots: 0,
    isFull: false,
  };

  for (const attendee of attendees) {
    if (attendee.responseStatus === AttendeeResponseStatus.GOING) {
      const attendeeHeadcount = getGoingHeadcount(attendee.plusOnesCount);
      summary.going += 1;
      summary.goingHeadcount += attendeeHeadcount;
      if (attendee.waitlistPosition === null) {
        summary.confirmedGoing += 1;
        summary.confirmedHeadcount += attendeeHeadcount;
      } else {
        summary.waitlistedGoing += 1;
        summary.waitlistedHeadcount += attendeeHeadcount;
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
    summary.remainingSpots = Math.max(capacityLimit - summary.confirmedHeadcount, 0);
    summary.isFull = summary.remainingSpots === 0;
  }

  return summary;
}

export function sortAttendeesForOrganizer<T extends AttendeePlacementInput>(attendees: readonly T[]): T[] {
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
