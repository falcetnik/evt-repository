export type AttendeeListItem = {
  key: string;
  guestName: string;
  guestEmail: string;
  status: 'going' | 'maybe' | 'not_going';
  attendanceState: 'confirmed' | 'waitlisted' | 'not_attending';
  waitlistPosition: number | null;
};

export const buildAttendeeStatusLabel = (attendee: AttendeeListItem): string => {
  if (attendee.attendanceState === 'confirmed') {
    return 'Going · Confirmed';
  }

  if (attendee.attendanceState === 'waitlisted') {
    if (typeof attendee.waitlistPosition === 'number') {
      return `Going · Waitlist #${attendee.waitlistPosition}`;
    }

    return 'Going · Waitlisted';
  }

  if (attendee.status === 'maybe') {
    return 'Maybe';
  }

  return 'Not going';
};
