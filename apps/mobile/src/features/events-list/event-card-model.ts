import type { OrganizerEventListItem } from '../../api/events';

export type { OrganizerEventListItem };

export type EventCardModel = {
  id: string;
  title: string;
  startsAtLabel: string;
  timezoneLabel: string;
  locationLabel: string;
  capacityLabel: string;
  rsvpSummaryLabel: string;
  inviteLinkLabel: string;
  reminderLabel: string;
};

export const mapEventToCardModel = (event: OrganizerEventListItem): EventCardModel => {
  const startsAtDate = new Date(event.startsAt);
  const startsAtLabel = Number.isNaN(startsAtDate.getTime())
    ? event.startsAt
    : startsAtDate.toISOString().replace('.000Z', 'Z');

  return {
    id: event.id,
    title: event.title,
    startsAtLabel: `Starts: ${startsAtLabel}`,
    timezoneLabel: `Timezone: ${event.timezone}`,
    locationLabel: event.location ? `Location: ${event.location}` : 'Location: Not specified',
    capacityLabel: event.capacityLimit === null ? 'Capacity: No limit' : `Capacity: ${event.capacityLimit}`,
    rsvpSummaryLabel: `RSVP: total ${event.summary.total} · going ${event.summary.going} · maybe ${event.summary.maybe} · not going ${event.summary.notGoing}`,
    inviteLinkLabel: `Invite: ${event.hasActiveInviteLink ? 'Active' : 'Inactive'}`,
    reminderLabel: `Reminders: ${event.activeReminderCount} active`,
  };
};
