import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DB_TO_RSVP_STATUS, toSummary } from '../rsvp/rsvp.types';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttendeesForOrganizer(eventId: string, organizerUserId: string) {
    const event = await this.prisma.client.event.findFirst({
      where: {
        id: eventId,
        organizerUserId,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const attendees = await this.prisma.client.eventAttendee.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      eventId,
      summary: toSummary(attendees.map((attendee) => attendee.responseStatus)),
      attendees: attendees.map((attendee) => ({
        attendeeId: attendee.id,
        guestName: attendee.guestName,
        guestEmail: attendee.guestEmail,
        status: DB_TO_RSVP_STATUS[attendee.responseStatus],
        createdAt: attendee.createdAt.toISOString(),
        updatedAt: attendee.updatedAt.toISOString(),
      })),
    };
  }
}
