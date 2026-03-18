export type AttendanceStatus = 'GOING' | 'MAYBE' | 'NOT_GOING';

export type AttendanceRecord = {
  id: string;
  status: AttendanceStatus;
  waitlistPosition: number | null;
  createdAt: Date;
};

export type AttendanceState = 'confirmed' | 'waitlisted' | 'not_attending';

export const deriveAttendanceState = (status: AttendanceStatus, waitlistPosition: number | null): AttendanceState => {
  if (status !== 'GOING') {
    return 'not_attending';
  }

  return waitlistPosition === null ? 'confirmed' : 'waitlisted';
};

export const buildRsvpSummary = (attendees: AttendanceRecord[], capacityLimit: number | null) => {
  const going = attendees.filter((attendee) => attendee.status === 'GOING').length;
  const maybe = attendees.filter((attendee) => attendee.status === 'MAYBE').length;
  const notGoing = attendees.filter((attendee) => attendee.status === 'NOT_GOING').length;
  const confirmedGoing = attendees.filter(
    (attendee) => attendee.status === 'GOING' && attendee.waitlistPosition === null,
  ).length;
  const waitlistedGoing = attendees.filter(
    (attendee) => attendee.status === 'GOING' && attendee.waitlistPosition !== null,
  ).length;

  const remainingSpots = capacityLimit === null ? 0 : Math.max(capacityLimit - confirmedGoing, 0);

  return {
    going,
    maybe,
    notGoing,
    total: attendees.length,
    confirmedGoing,
    waitlistedGoing,
    capacityLimit,
    remainingSpots,
    isFull: capacityLimit === null ? false : remainingSpots === 0,
  };
};

const sortByCreatedAtThenId = (a: AttendanceRecord, b: AttendanceRecord) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

export const sortAttendeeRecords = <T extends AttendanceRecord>(attendees: T[]): T[] => {
  const confirmed = attendees
    .filter((attendee) => attendee.status === 'GOING' && attendee.waitlistPosition === null)
    .sort(sortByCreatedAtThenId);
  const waitlisted = attendees
    .filter((attendee) => attendee.status === 'GOING' && attendee.waitlistPosition !== null)
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.id.localeCompare(b.id));
  const maybe = attendees.filter((attendee) => attendee.status === 'MAYBE').sort(sortByCreatedAtThenId);
  const notGoing = attendees.filter((attendee) => attendee.status === 'NOT_GOING').sort(sortByCreatedAtThenId);

  return [...confirmed, ...waitlisted, ...maybe, ...notGoing];
};
