import { describe, expect, it } from 'vitest';
import {
  ATTENDEE_FILTER_OPTIONS,
  buildAttendeeFilterCounts,
  filterAttendeesBySelection,
  type AttendeeFilter,
  type AttendeeListItem,
} from './attendee-filter-model';

const attendees: AttendeeListItem[] = [
  {
    key: 'a-confirmed',
    guestName: 'Alex Confirmed',
    guestEmail: 'alex@example.com',
    status: 'going',
    attendanceState: 'confirmed',
    waitlistPosition: null,
  },
  {
    key: 'a-waitlist-2',
    guestName: 'Wade Waitlist',
    guestEmail: 'wade@example.com',
    status: 'going',
    attendanceState: 'waitlisted',
    waitlistPosition: 2,
  },
  {
    key: 'a-maybe',
    guestName: 'Maya Maybe',
    guestEmail: 'maya@example.com',
    status: 'maybe',
    attendanceState: 'not_attending',
    waitlistPosition: null,
  },
  {
    key: 'a-not-going',
    guestName: 'Nora No',
    guestEmail: 'nora@example.com',
    status: 'not_going',
    attendanceState: 'not_attending',
    waitlistPosition: null,
  },
];

describe('attendee filter model', () => {
  it('derives counts for all supported filters', () => {
    const counts = buildAttendeeFilterCounts(attendees);

    expect(ATTENDEE_FILTER_OPTIONS).toEqual(['all', 'confirmed', 'waitlisted', 'maybe', 'not_going']);
    expect(counts).toEqual({
      all: 4,
      confirmed: 1,
      waitlisted: 1,
      maybe: 1,
      not_going: 1,
    });
  });

  it('keeps backend order for all filter', () => {
    const filtered = filterAttendeesBySelection(attendees, 'all');

    expect(filtered.map((attendee) => attendee.key)).toEqual([
      'a-confirmed',
      'a-waitlist-2',
      'a-maybe',
      'a-not-going',
    ]);
  });

  it.each<[AttendeeFilter, string[]]>([
    ['confirmed', ['a-confirmed']],
    ['waitlisted', ['a-waitlist-2']],
    ['maybe', ['a-maybe']],
    ['not_going', ['a-not-going']],
  ])('shows only %s attendees', (filter, expectedKeys) => {
    const filtered = filterAttendeesBySelection(attendees, filter);

    expect(filtered.map((attendee) => attendee.key)).toEqual(expectedKeys);
  });

  it('supports empty filtered result cleanly', () => {
    const noWaitlistAttendees = attendees.filter((attendee) => attendee.attendanceState !== 'waitlisted');

    const filtered = filterAttendeesBySelection(noWaitlistAttendees, 'waitlisted');

    expect(filtered).toEqual([]);
  });
});
