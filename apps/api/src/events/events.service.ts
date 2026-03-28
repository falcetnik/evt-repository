import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeResponseStatus } from '@prisma/client';
import {
  buildGoingWaitlistPlacement,
  buildRsvpSummary,
  deriveAttendanceState,
  getGoingHeadcount,
  sortAttendeesForOrganizer,
} from '../attendance/attendance-summary';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { toOrganizerInviteLinkResponse } from '../invite-links/invite-link-response';
import { buildReminderPlan } from './reminders/reminder-schedule';
import { CreateEventDto } from './dto/create-event.dto';
import { EventListScope } from './dto/list-events.query.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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
        allowPlusOnes: dto.allowPlusOnes ?? false,
      },
    });

    await this.auditService.logOrganizerAction({
      actorUserId: currentUser.id,
      action: 'event.created',
      entityType: 'event',
      entityId: event.id,
      metadata: {
        hasTitle: dto.title !== undefined,
        hasDescription: dto.description !== undefined && dto.description !== null,
        hasLocation: dto.location !== undefined && dto.location !== null,
        hasStartsAt: dto.startsAt !== undefined,
        hasTimezone: dto.timezone !== undefined,
        hasCapacityLimit: dto.capacityLimit !== undefined,
        allowPlusOnes: dto.allowPlusOnes ?? false,
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
        allowPlusOnes: true,
        createdAt: true,
        updatedAt: true,
        attendees: {
          select: {
            responseStatus: true,
            waitlistPosition: true,
            plusOnesCount: true,
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
      allowPlusOnes: event.allowPlusOnes,
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

  async deleteEvent(currentUser: AuthUser, eventId: string) {
    await this.prisma.client.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id: eventId,
          organizerUserId: currentUser.id,
        },
        select: {
          id: true,
          capacityLimit: true,
          startsAt: true,
          timezone: true,
          _count: {
            select: {
              attendees: true,
              inviteLinks: true,
              reminders: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      await tx.event.delete({ where: { id: event.id } });

      await this.auditService.logAction({
        tx,
        actorUserId: currentUser.id,
        action: 'event.deleted',
        entityType: 'event',
        entityId: event.id,
        metadata: {
          attendeeCount: event._count.attendees,
          inviteLinkCount: event._count.inviteLinks,
          reminderCount: event._count.reminders,
          capacityLimit: event.capacityLimit,
          startsAt: event.startsAt.toISOString(),
          timezone: event.timezone,
        },
      });
    });
  }

  async updateEvent(currentUser: AuthUser, eventId: string, dto: UpdateEventDto) {
    const now = new Date();

    const updatedEvent = await this.prisma.client.$transaction(async (tx) => {
      const eventRows = await tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          description: string | null;
          location_name: string | null;
          starts_at: Date;
          timezone: string;
          capacity_limit: number | null;
          allow_plus_ones: boolean;
          organizer_user_id: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT id, title, description, location_name, starts_at, timezone, capacity_limit, allow_plus_ones, organizer_user_id, created_at, updated_at
        FROM events
        WHERE id = ${eventId} AND organizer_user_id = ${currentUser.id}
        FOR UPDATE
      `;

      const eventRow = eventRows[0];
      if (!eventRow) {
        throw new NotFoundException('Event not found');
      }

      const nextStartsAt = dto.startsAt ? new Date(dto.startsAt) : eventRow.starts_at;
      const startsAtChanged = dto.startsAt !== undefined && nextStartsAt.getTime() !== eventRow.starts_at.getTime();
      const hasCapacityLimitField = dto.capacityLimit !== undefined;
      const capacityChanged = hasCapacityLimitField && dto.capacityLimit !== eventRow.capacity_limit;

      if (startsAtChanged) {
        const existingReminders = await tx.eventReminder.findMany({
          where: { eventId },
          orderBy: [{ sendAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            offsetMinutes: true,
          },
        });

        const reminderPlan = buildReminderPlan({
          startsAt: nextStartsAt,
          offsetsMinutes: existingReminders.map((reminder) => reminder.offsetMinutes),
          now,
        });

        const sendAtByOffset = new Map(reminderPlan.map((reminder) => [reminder.offsetMinutes, reminder.sendAt]));
        for (const reminder of existingReminders) {
          const nextSendAt = sendAtByOffset.get(reminder.offsetMinutes);
          if (!nextSendAt) {
            throw new BadRequestException('Invalid reminder schedule update');
          }

          await tx.eventReminder.update({
            where: { id: reminder.id },
            data: { sendAt: nextSendAt },
          });
        }
      }

      if (capacityChanged) {
        const attendees = await tx.eventAttendee.findMany({
          where: { eventId },
          select: {
            id: true,
            responseStatus: true,
            waitlistPosition: true,
            createdAt: true,
            plusOnesCount: true,
          },
        });

        const goingAttendees = attendees.filter((attendee) => attendee.responseStatus === AttendeeResponseStatus.GOING);
        const confirmedGoing = goingAttendees.filter((attendee) => attendee.waitlistPosition === null);
        const waitlistedGoingBefore = goingAttendees.filter((attendee) => attendee.waitlistPosition !== null);
        const confirmedGoingBeforeCount = confirmedGoing.length;
        const waitlistedGoingBeforeCount = waitlistedGoingBefore.length;
        const confirmedHeadcountBefore = confirmedGoing.reduce((total, attendee) => total + getGoingHeadcount(attendee.plusOnesCount), 0);

        if (dto.capacityLimit !== null && dto.capacityLimit !== undefined && dto.capacityLimit < confirmedHeadcountBefore) {
          throw new BadRequestException('capacityLimit cannot be below confirmed headcount');
        }

        const nextCapacityLimit = hasCapacityLimitField ? (dto.capacityLimit ?? null) : eventRow.capacity_limit;
        const nextWaitlistPositionById = buildGoingWaitlistPlacement(attendees, nextCapacityLimit);

        for (const attendee of attendees) {
          const nextWaitlistPosition = nextWaitlistPositionById.get(attendee.id) ?? null;
          if (attendee.waitlistPosition !== nextWaitlistPosition) {
            await tx.eventAttendee.update({
              where: { id: attendee.id },
              data: { waitlistPosition: nextWaitlistPosition },
            });
          }
        }

        const confirmedGoingAfterCount = goingAttendees.filter((attendee) => {
          const waitlistPosition = nextWaitlistPositionById.get(attendee.id) ?? null;
          return waitlistPosition === null;
        }).length;
        const waitlistedGoingAfterCount = goingAttendees.length - confirmedGoingAfterCount;
        const promotedCount = goingAttendees.filter((attendee) => {
          const wasWaitlisted = attendee.waitlistPosition !== null;
          const nextWaitlistPosition = nextWaitlistPositionById.get(attendee.id) ?? null;
          return wasWaitlisted && nextWaitlistPosition === null;
        }).length;
        const placementChanged = attendees.some((attendee) => {
          const nextWaitlistPosition = nextWaitlistPositionById.get(attendee.id) ?? null;
          return attendee.waitlistPosition !== nextWaitlistPosition;
        });

        if (placementChanged) {
          await this.auditService.logAction({
            tx,
            actorUserId: currentUser.id,
            action: 'event.attendance.rebalanced',
            entityType: 'event',
            entityId: eventId,
            metadata: {
              capacityBefore: eventRow.capacity_limit,
              capacityAfter: dto.capacityLimit,
              confirmedGoingBefore: confirmedGoingBeforeCount,
              confirmedGoingAfter: confirmedGoingAfterCount,
              waitlistedGoingBefore: waitlistedGoingBeforeCount,
              waitlistedGoingAfter: waitlistedGoingAfterCount,
              promotedCount,
            },
          });
        }
      }

      const updateData: {
        title?: string;
        description?: string | null;
        locationName?: string | null;
        startsAt?: Date;
        timezone?: string;
        capacityLimit?: number | null;
        allowPlusOnes?: boolean;
      } = {};

      if (dto.title !== undefined) {
        updateData.title = dto.title;
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description;
      }
      if (dto.location !== undefined) {
        updateData.locationName = dto.location;
      }
      if (dto.startsAt !== undefined) {
        updateData.startsAt = nextStartsAt;
      }
      if (dto.timezone !== undefined) {
        updateData.timezone = dto.timezone;
      }
      if (hasCapacityLimitField) {
          updateData.capacityLimit = dto.capacityLimit;
      }
      if (dto.allowPlusOnes !== undefined) {
        if (dto.allowPlusOnes === false && eventRow.allow_plus_ones) {
          const attendeesWithPlusOnes = await tx.eventAttendee.count({
            where: {
              eventId,
              plusOnesCount: { gt: 0 },
            },
          });

          if (attendeesWithPlusOnes > 0) {
            throw new BadRequestException('allowPlusOnes cannot be disabled while attendees have plus ones');
          }
        }

        updateData.allowPlusOnes = dto.allowPlusOnes;
      }

      if (Object.keys(updateData).length === 0) {
        return tx.event.findUniqueOrThrow({ where: { id: eventId } });
      }

      return tx.event.update({
        where: { id: eventId },
        data: updateData,
      });
    });

    await this.auditService.logOrganizerAction({
      actorUserId: currentUser.id,
      action: 'event.updated',
      entityType: 'event',
      entityId: updatedEvent.id,
      metadata: {
        changedFields: Object.keys(dto).sort(),
        startsAtChanged: dto.startsAt !== undefined,
        capacityLimitChanged: dto.capacityLimit !== undefined,
        allowPlusOnesChanged: dto.allowPlusOnes !== undefined,
      },
    });

    return this.toResponse(updatedEvent);
  }

  async getAttendees(currentUser: AuthUser, eventId: string) {
    const event = await this.findOwnedEvent(currentUser, eventId, {
      id: true,
      capacityLimit: true,
      allowPlusOnes: true,
    });

    const attendees = await this.prisma.client.eventAttendee.findMany({
      where: { eventId },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        responseStatus: true,
        waitlistPosition: true,
        plusOnesCount: true,
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
      plusOnesCount: attendee.plusOnesCount,
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
    await this.auditService.logOrganizerAction({
      actorUserId: currentUser.id,
      action: 'event.reminders.replaced',
      entityType: 'event',
      entityId: event.id,
      metadata: {
        reminderCount: offsetsMinutes.length,
        offsetsMinutes: [...offsetsMinutes].sort((a, b) => b - a),
      },
    });

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

  async getCurrentInviteLink(currentUser: AuthUser, eventId: string) {
    await this.findOwnedEvent(currentUser, eventId, { id: true });

    const now = new Date();
    const inviteLink = await this.findCurrentUsableInviteLink(eventId, now);

    if (!inviteLink) {
      return {
        eventId,
        inviteLink: null,
      };
    }

    return {
      eventId,
      inviteLink: toOrganizerInviteLinkResponse(inviteLink, this.getInviteBaseUrl()),
    };
  }

  async revokeCurrentInviteLink(currentUser: AuthUser, eventId: string) {
    await this.findOwnedEvent(currentUser, eventId, { id: true });

    const now = new Date();
    const inviteLink = await this.findCurrentUsableInviteLink(eventId, now);

    if (!inviteLink) {
      await this.auditService.logOrganizerAction({
        actorUserId: currentUser.id,
        action: 'event.invite_link.revoked',
        entityType: 'event',
        entityId: eventId,
        metadata: { result: 'noop' },
      });
      return;
    }

    await this.prisma.client.inviteLink.update({
      where: { token: inviteLink.token },
      data: { isActive: false },
    });

    await this.auditService.logOrganizerAction({
      actorUserId: currentUser.id,
      action: 'event.invite_link.revoked',
      entityType: 'event',
      entityId: eventId,
      metadata: { result: 'revoked' },
    });
  }

  private async findCurrentUsableInviteLink(eventId: string, now: Date) {
    return this.prisma.client.inviteLink.findFirst({
      where: {
        eventId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        eventId: true,
        token: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
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
    allowPlusOnes: boolean;
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
      allowPlusOnes: event.allowPlusOnes,
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

  private getInviteBaseUrl() {
    const configuredBaseUrl = process.env.PUBLIC_INVITE_BASE_URL;
    return configuredBaseUrl && configuredBaseUrl.trim().length > 0
      ? configuredBaseUrl
      : 'http://localhost:3000/api/v1/invite-links';
  }
}
