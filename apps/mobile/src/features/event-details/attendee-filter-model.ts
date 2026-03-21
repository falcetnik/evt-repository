import type { AttendeeListItem } from './attendee-row-model';

export type { AttendeeListItem } from './attendee-row-model';

export type AttendeeFilter = 'all' | 'confirmed' | 'waitlisted' | 'maybe' | 'not_going';

export const ATTENDEE_FILTER_OPTIONS: AttendeeFilter[] = ['all', 'confirmed', 'waitlisted', 'maybe', 'not_going'];

export type AttendeeFilterCounts = Record<AttendeeFilter, number>;

export const filterAttendeesBySelection = (
  attendees: AttendeeListItem[],
  selectedFilter: AttendeeFilter,
): AttendeeListItem[] => {
  if (selectedFilter === 'all') {
    return attendees;
  }

  return attendees.filter((attendee) => {
    if (selectedFilter === 'confirmed') {
      return attendee.attendanceState === 'confirmed';
    }

    if (selectedFilter === 'waitlisted') {
      return attendee.attendanceState === 'waitlisted';
    }

    if (selectedFilter === 'maybe') {
      return attendee.status === 'maybe';
    }

    return attendee.status === 'not_going';
  });
};

export const buildAttendeeFilterCounts = (attendees: AttendeeListItem[]): AttendeeFilterCounts => ({
  all: attendees.length,
  confirmed: attendees.filter((attendee) => attendee.attendanceState === 'confirmed').length,
  waitlisted: attendees.filter((attendee) => attendee.attendanceState === 'waitlisted').length,
  maybe: attendees.filter((attendee) => attendee.status === 'maybe').length,
  not_going: attendees.filter((attendee) => attendee.status === 'not_going').length,
});
