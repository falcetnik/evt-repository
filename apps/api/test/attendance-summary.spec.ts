import {
  buildRsvpSummary,
  deriveAttendanceState,
  sortAttendeeRecords,
  type AttendanceRecord,
} from '../src/attendees/attendance.utils';

describe('attendance utils', () => {
  it('derives attendance state from status + waitlist position', () => {
    expect(deriveAttendanceState('GOING', null)).toBe('confirmed');
    expect(deriveAttendanceState('GOING', 2)).toBe('waitlisted');
    expect(deriveAttendanceState('MAYBE', null)).toBe('not_attending');
    expect(deriveAttendanceState('NOT_GOING', null)).toBe('not_attending');
  });

  it('builds RSVP summary with capacity fields', () => {
    const attendees: AttendanceRecord[] = [
      { id: 'a1', status: 'GOING', waitlistPosition: null, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'a2', status: 'GOING', waitlistPosition: 1, createdAt: new Date('2026-01-01T00:01:00.000Z') },
      { id: 'a3', status: 'MAYBE', waitlistPosition: null, createdAt: new Date('2026-01-01T00:02:00.000Z') },
      { id: 'a4', status: 'NOT_GOING', waitlistPosition: null, createdAt: new Date('2026-01-01T00:03:00.000Z') },
    ];

    expect(buildRsvpSummary(attendees, 1)).toEqual({
      going: 2,
      maybe: 1,
      notGoing: 1,
      total: 4,
      confirmedGoing: 1,
      waitlistedGoing: 1,
      capacityLimit: 1,
      remainingSpots: 0,
      isFull: true,
    });
  });

  it('sorts attendees in required organizer order', () => {
    const attendees: AttendanceRecord[] = [
      { id: 'maybe-1', status: 'MAYBE', waitlistPosition: null, createdAt: new Date('2026-01-01T00:03:00.000Z') },
      { id: 'wl-2', status: 'GOING', waitlistPosition: 2, createdAt: new Date('2026-01-01T00:04:00.000Z') },
      { id: 'confirmed-1', status: 'GOING', waitlistPosition: null, createdAt: new Date('2026-01-01T00:01:00.000Z') },
      { id: 'not-going-1', status: 'NOT_GOING', waitlistPosition: null, createdAt: new Date('2026-01-01T00:05:00.000Z') },
      { id: 'wl-1', status: 'GOING', waitlistPosition: 1, createdAt: new Date('2026-01-01T00:02:00.000Z') },
    ];

    expect(sortAttendeeRecords(attendees).map((a) => a.id)).toEqual([
      'confirmed-1',
      'wl-1',
      'wl-2',
      'maybe-1',
      'not-going-1',
    ]);
  });
});
