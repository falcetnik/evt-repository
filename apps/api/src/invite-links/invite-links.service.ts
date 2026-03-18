import { Injectable, NotFoundException } from '@nestjs/common';
import { EventAttendee } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PublicRsvpDto } from '../rsvp/dto/public-rsvp.dto';
import { DB_TO_RSVP_STATUS, RSVP_STATUS_TO_DB, toSummary } from '../rsvp/rsvp.types';

@Injectable()
export class InviteLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUsableInviteLink(token: string) {
    const now = new Date();
    const inviteLink = await this.prisma.client.inviteLink.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        event: {
          include: {
            attendees: {
              select: {
                responseStatus: true,
              },
            },
          },
        },
      },
    });

    if (!inviteLink) {
      throw new NotFoundException('Invite link not found');
    }

    return inviteLink;
  }

  async getPublicInvite(token: string) {
    const inviteLink = await this.resolveUsableInviteLink(token);
    const summary = toSummary(inviteLink.event.attendees.map((attendee) => attendee.responseStatus));

    return {
      eventId: inviteLink.event.id,
      title: inviteLink.event.title,
      description: inviteLink.event.description,
      startsAt: inviteLink.event.startsAt.toISOString(),
      endsAt: inviteLink.event.endsAt?.toISOString() ?? null,
      timezone: inviteLink.event.timezone,
      locationName: inviteLink.event.locationName,
      locationAddress: inviteLink.event.locationAddress,
      rsvpSummary: summary,
    };
  }

  async submitPublicRsvp(token: string, dto: PublicRsvpDto) {
    const inviteLink = await this.resolveUsableInviteLink(token);
    const current = await this.prisma.client.eventAttendee.findFirst({
      where: {
        eventId: inviteLink.eventId,
        guestEmail: dto.guestEmail,
      },
    });

    const data = {
      eventId: inviteLink.eventId,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      responseStatus: RSVP_STATUS_TO_DB[dto.status],
    };

    const attendee = current
      ? await this.prisma.client.eventAttendee.update({ where: { id: current.id }, data })
      : await this.prisma.client.eventAttendee.create({ data });

    return {
      attendee: this.toPublicAttendee(attendee),
      created: !current,
    };
  }

  private toPublicAttendee(attendee: EventAttendee) {
    return {
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      guestName: attendee.guestName,
      guestEmail: attendee.guestEmail,
      status: DB_TO_RSVP_STATUS[attendee.responseStatus],
      createdAt: attendee.createdAt.toISOString(),
      updatedAt: attendee.updatedAt.toISOString(),
    };
  }
}
