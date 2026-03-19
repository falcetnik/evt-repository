import type { PublicInviteResponse } from '../../api/public-invite';

export type PublicInviteViewModel = {
  tokenLabel: string;
  expiryLabel: string;
  event: {
    title: string;
    startsAtLabel: string;
    timezoneLabel: string;
    descriptionLabel: string;
    locationLabel: string;
    capacityLabel: string;
  };
  summary: {
    goingLabel: string;
    maybeLabel: string;
    notGoingLabel: string;
    totalLabel: string;
    confirmedGoingLabel: string;
    waitlistedGoingLabel: string;
    remainingSpotsLabel: string;
    isFullLabel: string;
  };
};

const toIsoLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('.000Z', 'Z');
};

export const mapPublicInviteToViewModel = (invite: PublicInviteResponse): PublicInviteViewModel => ({
  tokenLabel: `Token: ${invite.token}`,
  expiryLabel: `Expiry: ${invite.expiresAt ?? 'No expiry'}`,
  event: {
    title: invite.event.title,
    startsAtLabel: `Starts: ${toIsoLabel(invite.event.startsAt)}`,
    timezoneLabel: `Timezone: ${invite.event.timezone}`,
    descriptionLabel: `Description: ${invite.event.description ?? 'No description'}`,
    locationLabel: `Location: ${invite.event.location ?? 'Location not set'}`,
    capacityLabel: invite.event.capacityLimit === null ? 'Capacity: No limit' : `Capacity: ${invite.event.capacityLimit}`,
  },
  summary: {
    goingLabel: `Going: ${invite.rsvpSummary.going}`,
    maybeLabel: `Maybe: ${invite.rsvpSummary.maybe}`,
    notGoingLabel: `Not going: ${invite.rsvpSummary.notGoing}`,
    totalLabel: `Total: ${invite.rsvpSummary.total}`,
    confirmedGoingLabel: `Confirmed going: ${invite.rsvpSummary.confirmedGoing}`,
    waitlistedGoingLabel: `Waitlisted going: ${invite.rsvpSummary.waitlistedGoing}`,
    remainingSpotsLabel:
      invite.rsvpSummary.remainingSpots === null
        ? 'Remaining spots: Unlimited'
        : `Remaining spots: ${invite.rsvpSummary.remainingSpots}`,
    isFullLabel: `Full: ${invite.rsvpSummary.isFull ? 'Yes' : 'No'}`,
  },
});
