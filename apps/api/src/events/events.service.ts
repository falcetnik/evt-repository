import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeResponseStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(currentUser: AuthUser, dto: CreateEventDto) {
    const event = await this.prisma.client.event.create({
      data: {
        organizerUserId: currentUser.id,
        title: dto.title,
        description: dto.description ?? null,
        locationName: dto.location ?? null,
        startsAt: new Date(dto.startsAt),
        timezone: dto.timezone,
        capacityLimit: dto.capacityLimit ?? null,
      },
    });

    return this.toResponse(event);
  }

  async getEventById(currentUser: AuthUser, eventId: string) {
    const event = await this.prisma.client.event.findFirst({
      where: {
        id: eventId,
        organizerUserId: currentUser.id,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.toResponse(event);
  }

  async getAttendees(currentUser: AuthUser, eventId: string) {
    const event = await this.prisma.client.event.findFirst({
      where: {
        id: eventId,
        organizerUserId: currentUser.id,
      },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const attendees = await this.prisma.client.eventAttendee.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const summary = {
      going: 0,
      maybe: 0,
      notGoing: 0,
      total: attendees.length,
    };

    const attendeeResponses = attendees.map((attendee) => {
      if (attendee.responseStatus === AttendeeResponseStatus.GOING) {
        summary.going += 1;
      } else if (attendee.responseStatus === AttendeeResponseStatus.MAYBE) {
        summary.maybe += 1;
      } else if (attendee.responseStatus === AttendeeResponseStatus.NOT_GOING) {
        summary.notGoing += 1;
      }

      return {
        attendeeId: attendee.id,
        guestName: attendee.guestName,
        guestEmail: attendee.guestEmail,
        status: this.toApiStatus(attendee.responseStatus),
        createdAt: attendee.createdAt.toISOString(),
        updatedAt: attendee.updatedAt.toISOString(),
      };
    });

    return {
      eventId,
      summary,
      attendees: attendeeResponses,
    };
  }

  private toResponse(event: {
    id: string;
    title: string;
    description: string | null;
    locationName: string | null;
    startsAt: Date;
    timezone: string;
    capacityLimit: number | null;
    organizerUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.locationName,
      startsAt: event.startsAt.toISOString(),
      timezone: event.timezone,
      capacityLimit: event.capacityLimit,
      organizerUserId: event.organizerUserId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private toApiStatus(status: AttendeeResponseStatus): 'going' | 'maybe' | 'not_going' {
    if (status === AttendeeResponseStatus.GOING) {
      return 'going';
    }
    if (status === AttendeeResponseStatus.MAYBE) {
      return 'maybe';
    }
    return 'not_going';
  }
}
