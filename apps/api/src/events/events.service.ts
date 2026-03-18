import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeResponseStatus } from '@prisma/client';
import { buildRsvpSummary, deriveAttendanceState, sortAttendeesForOrganizer } from '../attendance/attendance-summary';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { buildReminderPlan } from './reminders/reminder-schedule';
import { CreateEventDto } from './dto/create-event.dto';
import { EventListScope } from './dto/list-events.query.dto';

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


  async listEvents(currentUser: AuthUser, scope: EventListScope) {
    const now = new Date();

    const events = await this.prisma.client.event.findMany({
      where: {
        organizerUserId: currentUser.id,
        ...this.buildScopeWhere(scope, now),
      },
      orderBy: this.buildScopeOrderBy(scope),
      select: {
        id: true,
        title: true,
        description: true,
        locationName: true,
        startsAt: true,
        timezone: true,
        capacityLimit: true,
        createdAt: true,
        updatedAt: true,
        attendees: {
          select: {
            responseStatus: true,
            waitlistPosition: true,
          },
        },
        inviteLinks: {
          select: {
            isActive: true,
            expiresAt: true,
          },
        },
        reminders: {
          select: {
            id: true,
          },
        },
      },
    });

    const responseEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.locationName,
      startsAt: event.startsAt.toISOString(),
      timezone: event.timezone,
      capacityLimit: event.capacityLimit,
      summary: buildRsvpSummary(event.attendees, event.capacityLimit),
      hasActiveInviteLink: event.inviteLinks.some(
        (inviteLink) => inviteLink.isActive && (inviteLink.expiresAt === null || inviteLink.expiresAt > now),
      ),
      activeReminderCount: event.reminders.length,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }));

    return {
      scope,
      total: responseEvents.length,
      events: responseEvents,
    };
  }

  async getEventById(currentUser: AuthUser, eventId: string) {
    const event = await this.findOwnedEvent(currentUser, eventId);

    return this.toResponse(event);
  }

  async getAttendees(currentUser: AuthUser, eventId: string) {
    const event = await this.findOwnedEvent(currentUser, eventId, {
      id: true,
      capacityLimit: true,
    });

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

  async replaceEventReminders(currentUser: AuthUser, eventId: string, offsetsMinutes: number[]) {
    const event = await this.findOwnedEvent(currentUser, eventId, {
      id: true,
      startsAt: true,
      timezone: true,
    });

    const reminderPlan = buildReminderPlan({
      startsAt: event.startsAt,
      offsetsMinutes,
      now: new Date(),
    });

    await this.prisma.client.$transaction(async (tx) => {
      await tx.eventReminder.deleteMany({ where: { eventId: event.id } });

      if (reminderPlan.length > 0) {
        await Promise.all(
          reminderPlan.map((reminder) =>
            tx.eventReminder.create({
              data: {
                eventId: event.id,
                offsetMinutes: reminder.offsetMinutes,
                sendAt: reminder.sendAt,
              },
            }),
          ),
        );
      }
    });

    const reminders = await this.listEventReminders(event.id);

    return this.toReminderScheduleResponse({
      eventId: event.id,
      startsAt: event.startsAt,
      timezone: event.timezone,
      reminders,
    });
  }

  async getEventReminders(currentUser: AuthUser, eventId: string) {
    const event = await this.findOwnedEvent(currentUser, eventId, {
      id: true,
      startsAt: true,
      timezone: true,
    });

    const reminders = await this.listEventReminders(event.id);

    return this.toReminderScheduleResponse({
      eventId: event.id,
      startsAt: event.startsAt,
      timezone: event.timezone,
      reminders,
    });
  }


  private buildScopeWhere(scope: EventListScope, now: Date) {
    if (scope === 'past') {
      return { startsAt: { lt: now } };
    }

    if (scope === 'all') {
      return {};
    }

    return { startsAt: { gte: now } };
  }

  private buildScopeOrderBy(scope: EventListScope) {
    if (scope === 'past') {
      return [{ startsAt: 'desc' as const }, { id: 'desc' as const }];
    }

    return [{ startsAt: 'asc' as const }, { id: 'asc' as const }];
  }

  private async listEventReminders(eventId: string) {
    return this.prisma.client.eventReminder.findMany({
      where: { eventId },
      orderBy: [{ sendAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        offsetMinutes: true,
        sendAt: true,
      },
    });
  }

  private toReminderScheduleResponse(params: {
    eventId: string;
    startsAt: Date;
    timezone: string;
    reminders: Array<{ id: string; offsetMinutes: number; sendAt: Date }>;
  }) {
    const reminders = params.reminders.map((reminder) => ({
      reminderId: reminder.id,
      offsetMinutes: reminder.offsetMinutes,
      sendAt: reminder.sendAt.toISOString(),
    }));

    return {
      eventId: params.eventId,
      startsAt: params.startsAt.toISOString(),
      timezone: params.timezone,
      reminders,
      total: reminders.length,
    };
  }

  private async findOwnedEvent<TSelect extends Record<string, boolean> | undefined = undefined>(
    currentUser: AuthUser,
    eventId: string,
    select?: TSelect,
  ) {
    const event = await this.prisma.client.event.findFirst({
      where: {
        id: eventId,
        organizerUserId: currentUser.id,
      },
      ...(select ? { select } : {}),
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
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
