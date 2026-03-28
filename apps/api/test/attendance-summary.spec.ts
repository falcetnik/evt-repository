import { AttendeeResponseStatus } from '@prisma/client';
import {
  buildRsvpSummary,
  deriveAttendanceState,
  sortAttendeesForOrganizer,
} from '../src/attendance/attendance-summary';

describe('attendance summary helpers', () => {
  it('derives attendanceState from status + waitlistPosition', () => {
    expect(deriveAttendanceState(AttendeeResponseStatus.GOING, null)).toBe('confirmed');
    expect(deriveAttendanceState(AttendeeResponseStatus.GOING, 1)).toBe('waitlisted');
    expect(deriveAttendanceState(AttendeeResponseStatus.MAYBE, null)).toBe('not_attending');
    expect(deriveAttendanceState(AttendeeResponseStatus.NOT_GOING, null)).toBe('not_attending');
  });

  it('builds RSVP summary with capacity fields', () => {
    const summary = buildRsvpSummary(
      [
        { responseStatus: AttendeeResponseStatus.GOING, waitlistPosition: null },
        { responseStatus: AttendeeResponseStatus.GOING, waitlistPosition: 1 },
        { responseStatus: AttendeeResponseStatus.MAYBE, waitlistPosition: null },
        { responseStatus: AttendeeResponseStatus.NOT_GOING, waitlistPosition: null },
      ],
      1,
    );

    expect(summary).toEqual({
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

  it('sorts attendees by placement order rules', () => {
    const sorted = sortAttendeesForOrganizer([
      {
        id: '4',
        responseStatus: AttendeeResponseStatus.NOT_GOING,
        waitlistPosition: null,
        createdAt: new Date('2026-03-20T10:03:00.000Z'),
      },
      {
        id: '2',
        responseStatus: AttendeeResponseStatus.GOING,
        waitlistPosition: 2,
        createdAt: new Date('2026-03-20T10:01:00.000Z'),
      },
      {
        id: '3',
        responseStatus: AttendeeResponseStatus.MAYBE,
        waitlistPosition: null,
        createdAt: new Date('2026-03-20T10:02:00.000Z'),
      },
      {
        id: '1',
        responseStatus: AttendeeResponseStatus.GOING,
        waitlistPosition: null,
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
      },
      {
        id: '5',
        responseStatus: AttendeeResponseStatus.GOING,
        waitlistPosition: 1,
        createdAt: new Date('2026-03-20T10:04:00.000Z'),
      },
    ]);

    expect(sorted.map((row: { id: string }) => row.id)).toEqual(['1', '5', '2', '3', '4']);
  });
});