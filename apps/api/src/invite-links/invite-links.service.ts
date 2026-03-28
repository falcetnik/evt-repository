import { AttendeeResponseStatus } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { buildGoingWaitlistPlacement, buildRsvpSummary, deriveAttendanceState } from '../attendance/attendance-summary';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { buildInviteUrl } from './invite-link-url';
import { toOrganizerInviteLinkResponse } from './invite-link-response';

@Injectable()
export class InviteLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createOrGetInviteLink(currentUser: AuthUser, eventId: string) {
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

    const now = new Date();
    const existingLink = await this.prisma.client.inviteLink.findFirst({
      where: {
        eventId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (existingLink) {
      await this.auditService.logOrganizerAction({
        actorUserId: currentUser.id,
        action: 'event.invite_link.upserted',
        entityType: 'event',
        entityId: eventId,
        metadata: { result: 'reused' },
      });

      return {
        statusCode: 200,
        payload: toOrganizerInviteLinkResponse(existingLink, this.getInviteBaseUrl()),
      };
    }

    const createdLink = await this.createInviteLinkWithUniqueToken(eventId);
    await this.auditService.logOrganizerAction({
      actorUserId: currentUser.id,
      action: 'event.invite_link.upserted',
      entityType: 'event',
      entityId: eventId,
      metadata: { result: 'created' },
    });

    return {
      statusCode: 201,
      payload: toOrganizerInviteLinkResponse(createdLink, this.getInviteBaseUrl()),
    };
  }

  async resolvePublicInviteLink(token: string) {
    const link = await this.findUsableInviteLinkOrThrow(token);
    const rsvpSummary = await this.getRsvpSummary(link.eventId, link.event.capacityLimit);

    const inviteUrl = this.getInviteBaseUrl();

    return {
      token: link.token,
      url: buildInviteUrl(inviteUrl, link.token),
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      rsvpSummary,
      event: {
        title: link.event.title,
        description: link.event.description,
        location: link.event.locationName,
        startsAt: link.event.startsAt.toISOString(),
        timezone: link.event.timezone,
        capacityLimit: link.event.capacityLimit,
        allowPlusOnes: link.event.allowPlusOnes,
      },
    };
  }

  async submitPublicRsvp(token: string, dto: SubmitRsvpDto) {
    const link = await this.findUsableInviteLinkOrThrow(token);
    const status = this.toDbStatus(dto.status);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const lockedEvent = await tx.$queryRaw<Array<{ id: string; capacity_limit: number | null; allow_plus_ones: boolean }>>`
        SELECT id, capacity_limit, allow_plus_ones
        FROM events
        WHERE id = ${link.eventId}
        FOR UPDATE
      `;

      if (lockedEvent.length === 0) {
        throw new NotFoundException('Event not found');
      }

      const plusOnesCount = dto.plusOnesCount ?? 0;
      const allowPlusOnes = Boolean(lockedEvent[0]?.allow_plus_ones);

      if (!allowPlusOnes && plusOnesCount > 0) {
        throw new BadRequestException('plusOnesCount must be 0 when event does not allow plus ones');
      }

      const existingAttendee = await tx.eventAttendee.findUnique({
        where: {
          eventId_guestEmail: {
            eventId: link.eventId,
            guestEmail: dto.guestEmail,
          },
        },
      });

      const isCreate = !existingAttendee;

      const currentAttendee = existingAttendee
        ? await tx.eventAttendee.update({
            where: { id: existingAttendee.id },
            data: {
              guestName: dto.guestName,
              responseStatus: status,
              plusOnesCount,
            },
          })
        : await tx.eventAttendee.create({
            data: {
              eventId: link.eventId,
              guestName: dto.guestName,
              guestEmail: dto.guestEmail,
              responseStatus: status,
              plusOnesCount,
            },
          });

      const attendeesAfter = await tx.eventAttendee.findMany({
        where: { eventId: link.eventId },
        select: {
          id: true,
          responseStatus: true,
          waitlistPosition: true,
          createdAt: true,
          plusOnesCount: true,
        },
      });

      const capacityLimit = lockedEvent[0]?.capacity_limit ?? null;

      const nextWaitlistPositionById = buildGoingWaitlistPlacement(attendeesAfter, capacityLimit);

      for (const attendee of attendeesAfter) {
        const nextWaitlistPosition = nextWaitlistPositionById.get(attendee.id) ?? null;
        if (attendee.waitlistPosition !== nextWaitlistPosition) {
          await tx.eventAttendee.update({
            where: { id: attendee.id },
            data: { waitlistPosition: nextWaitlistPosition },
          });
        }
      }

      const finalAttendee = await tx.eventAttendee.findUniqueOrThrow({
        where: { id: currentAttendee.id },
      });

      await this.auditService.logAction({
        tx,
        actorUserId: null,
        action: isCreate ? 'event.rsvp.created' : 'event.rsvp.updated',
        entityType: 'event',
        entityId: link.eventId,
        metadata: {
          attendeeId: finalAttendee.id,
          status: this.toApiStatus(finalAttendee.responseStatus),
          plusOnesCount: finalAttendee.plusOnesCount,
          attendanceState: deriveAttendanceState(finalAttendee.responseStatus, finalAttendee.waitlistPosition),
          waitlistPosition: finalAttendee.waitlistPosition,
        },
      });

      return {
        statusCode: isCreate ? 201 : 200,
        payload: this.toAttendeeResponse(finalAttendee),
      };
    });

    return result;
  }

  private async createInviteLinkWithUniqueToken(eventId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.client.inviteLink.create({
          data: {
            eventId,
            token: this.generateToken(),
            isActive: true,
            expiresAt: null,
          },
        });
      } catch (error: unknown) {
        const isUniqueTokenConflict =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'P2002';

        if (isUniqueTokenConflict) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate unique invite token');
  }

  private async findUsableInviteLinkOrThrow(token: string) {
    const now = new Date();
    const link = await this.prisma.client.inviteLink.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        event: true,
      },
    });

    if (!link?.event) {
      throw new NotFoundException('Invite link not found');
    }

    return link;
  }

  private toDbStatus(status: SubmitRsvpDto['status']): AttendeeResponseStatus {
    if (status === 'going') {
      return AttendeeResponseStatus.GOING;
    }
    if (status === 'maybe') {
      return AttendeeResponseStatus.MAYBE;
    }
    return AttendeeResponseStatus.NOT_GOING;
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

  private toAttendeeResponse(attendee: {
    id: string;
    eventId: string;
    guestName: string | null;
    guestEmail: string | null;
    responseStatus: AttendeeResponseStatus;
    plusOnesCount: number;
    waitlistPosition: number | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      guestName: attendee.guestName,
      guestEmail: attendee.guestEmail,
      status: this.toApiStatus(attendee.responseStatus),
      plusOnesCount: attendee.plusOnesCount,
      attendanceState: deriveAttendanceState(attendee.responseStatus, attendee.waitlistPosition),
      waitlistPosition: attendee.waitlistPosition,
      createdAt: attendee.createdAt.toISOString(),
      updatedAt: attendee.updatedAt.toISOString(),
    };
  }

  private async getRsvpSummary(eventId: string, capacityLimit: number | null) {
    const attendees = await this.prisma.client.eventAttendee.findMany({
      where: { eventId },
      select: {
        responseStatus: true,
        waitlistPosition: true,
        plusOnesCount: true,
      },
    });

    return buildRsvpSummary(attendees, capacityLimit);
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private getInviteBaseUrl(): string {
    const rawBaseUrl = process.env.PUBLIC_INVITE_BASE_URL;
    if (!rawBaseUrl || rawBaseUrl.trim().length === 0) {
      throw new Error('PUBLIC_INVITE_BASE_URL must be a non-empty string');
    }

    return rawBaseUrl.trim().replace(/\/$/, '');
  }
}
