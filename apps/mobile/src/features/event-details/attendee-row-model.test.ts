import { describe, expect, it } from 'vitest';
import { buildAttendeePlusOnesLabel, buildAttendeeStatusLabel, type AttendeeListItem } from './attendee-row-model';

const makeAttendee = (overrides: Partial<AttendeeListItem>): AttendeeListItem => ({
  key: 'attendee-1',
  guestName: 'Guest',
  guestEmail: 'guest@example.com',
  status: 'going',
  attendanceState: 'confirmed',
  waitlistPosition: null,
  plusOnesCount: 0,
  ...overrides,
});

describe('attendee row model', () => {
  it('maps confirmed attendee to Going · Confirmed', () => {
    expect(buildAttendeeStatusLabel(makeAttendee({ attendanceState: 'confirmed' }))).toBe('Going · Confirmed');
  });

  it('maps waitlisted attendee with position to Going · Waitlist #N', () => {
    expect(
      buildAttendeeStatusLabel(makeAttendee({ attendanceState: 'waitlisted', waitlistPosition: 3 })),
    ).toBe('Going · Waitlist #3');
  });

  it('maps waitlisted attendee without numeric position to Going · Waitlisted', () => {
    expect(
      buildAttendeeStatusLabel(makeAttendee({ attendanceState: 'waitlisted', waitlistPosition: null })),
    ).toBe('Going · Waitlisted');
  });

  it('maps maybe attendee to Maybe', () => {
    expect(buildAttendeeStatusLabel(makeAttendee({ status: 'maybe', attendanceState: 'not_attending' }))).toBe('Maybe');
  });

  it('maps not-going attendee to Not going', () => {
    expect(
      buildAttendeeStatusLabel(makeAttendee({ status: 'not_going', attendanceState: 'not_attending' })),
    ).toBe('Not going');
  });

  it('returns null for zero plus-ones count', () => {
    expect(buildAttendeePlusOnesLabel(makeAttendee({ plusOnesCount: 0 }))).toBeNull();
  });

  it('returns +1 for a single plus-one', () => {
    expect(buildAttendeePlusOnesLabel(makeAttendee({ plusOnesCount: 1 }))).toBe('+1');
  });

  it('returns +N for multiple plus-ones', () => {
    expect(buildAttendeePlusOnesLabel(makeAttendee({ plusOnesCount: 3 }))).toBe('+3');
  });
});
