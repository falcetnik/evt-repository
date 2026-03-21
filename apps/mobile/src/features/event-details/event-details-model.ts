import type { OrganizerEventDetailsBundle } from '../../api/event-details';
import type { AttendeeListItem } from './attendee-row-model';

export type EventDetailsViewModel = {
  event: {
    title: string;
    startsAtLabel: string;
    timezoneLabel: string;
    descriptionLabel: string;
    locationLabel: string;
    capacityLabel: string;
  };
  summary: {
    totalLabel: string;
    goingLabel: string;
    maybeLabel: string;
    notGoingLabel: string;
    confirmedGoingLabel: string;
    waitlistedGoingLabel: string;
    remainingSpotsLabel: string;
    isFullLabel: string;
  };
  attendees: AttendeeListItem[];
  attendeesEmptyMessage: string | null;
  reminders: Array<{
    key: string;
    offsetMinutes: number;
    offsetLabel: string;
    sendAtLabel: string;
  }>;
  remindersEmptyMessage: string | null;
};

const toIsoLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('.000Z', 'Z');
};

export const mapEventDetailsToViewModel = (bundle: OrganizerEventDetailsBundle): EventDetailsViewModel => {
  const attendees = bundle.attendees.attendees.map((attendee) => ({
    key: attendee.attendeeId,
    guestName: attendee.guestName,
    guestEmail: attendee.guestEmail,
    status: attendee.status,
    attendanceState: attendee.attendanceState,
    waitlistPosition: attendee.waitlistPosition,
  }));

  const reminders = bundle.reminders.reminders.map((reminder) => ({
    key: reminder.reminderId,
    offsetMinutes: reminder.offsetMinutes,
    offsetLabel: `Offset: ${reminder.offsetMinutes} min before`,
    sendAtLabel: `Sends at: ${toIsoLabel(reminder.sendAt)}`,
  }));

  return {
    event: {
      title: bundle.event.title,
      startsAtLabel: `Starts: ${toIsoLabel(bundle.event.startsAt)}`,
      timezoneLabel: `Timezone: ${bundle.event.timezone}`,
      descriptionLabel: `Description: ${bundle.event.description ?? 'No description'}`,
      locationLabel: `Location: ${bundle.event.location ?? 'Location not set'}`,
      capacityLabel:
        bundle.event.capacityLimit === null ? 'Capacity: No limit' : `Capacity: ${bundle.event.capacityLimit}`,
    },
    summary: {
      totalLabel: `Total: ${bundle.attendees.summary.total}`,
      goingLabel: `Going: ${bundle.attendees.summary.going}`,
      maybeLabel: `Maybe: ${bundle.attendees.summary.maybe}`,
      notGoingLabel: `Not going: ${bundle.attendees.summary.notGoing}`,
      confirmedGoingLabel: `Confirmed going: ${bundle.attendees.summary.confirmedGoing}`,
      waitlistedGoingLabel: `Waitlisted going: ${bundle.attendees.summary.waitlistedGoing}`,
      remainingSpotsLabel:
        bundle.attendees.summary.remainingSpots === null
          ? 'Remaining spots: Unlimited'
          : `Remaining spots: ${bundle.attendees.summary.remainingSpots}`,
      isFullLabel: `Full: ${bundle.attendees.summary.isFull ? 'Yes' : 'No'}`,
    },
    attendees,
    attendeesEmptyMessage: attendees.length === 0 ? 'No attendees yet.' : null,
    reminders,
    remindersEmptyMessage: reminders.length === 0 ? 'No reminders scheduled.' : null,
  };
};
