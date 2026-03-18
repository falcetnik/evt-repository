import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeResponseStatus } from '@prisma/client';
import { buildRsvpSummary, deriveAttendanceState, sortAttendeesForOrganizer } from '../attendance/attendance-summary';
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
      select: {
        id: true,
        capacityLimit: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const attendees = await this.prisma.client.eventAttendee.findMany({
      where: { eventId },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        responseStatus: true,
        waitlistPosition: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const sortedAttendees = sortAttendeesForOrganizer(attendees);
    const summary = buildRsvpSummary(attendees, event.capacityLimit);

    const attendeeResponses = sortedAttendees.map((attendee) => ({
      attendeeId: attendee.id,
      guestName: attendee.guestName,
      guestEmail: attendee.guestEmail,
      status: this.toApiStatus(attendee.responseStatus),
      attendanceState: deriveAttendanceState(attendee.responseStatus, attendee.waitlistPosition),
      waitlistPosition: attendee.waitlistPosition,
      createdAt: attendee.createdAt.toISOString(),
      updatedAt: attendee.updatedAt.toISOString(),
    }));

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
