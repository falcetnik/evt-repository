import { AttendeeResponseStatus } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { buildInviteUrl } from './invite-link-url';

@Injectable()
export class InviteLinksService {
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: { createdAt: 'desc' },
    });

    if (existingLink) {
      return {
        statusCode: 200,
        payload: this.toOrganizerResponse(existingLink),
      };
    }

    const createdLink = await this.createInviteLinkWithUniqueToken(eventId);
    return {
      statusCode: 201,
      payload: this.toOrganizerResponse(createdLink),
    };
  }

  async resolvePublicInviteLink(token: string) {
    const link = await this.findUsableInviteLinkOrThrow(token);
    const rsvpSummary = await this.getRsvpSummary(link.eventId);

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

    const existingAttendee = await this.prisma.client.eventAttendee.findUnique({
      where: {
        eventId_guestEmail: {
          eventId: link.eventId,
          guestEmail: dto.guestEmail,
        },
      },
    });

    if (!existingAttendee) {
      const createdAttendee = await this.prisma.client.eventAttendee.create({
        data: {
          eventId: link.eventId,
          guestName: dto.guestName,
          guestEmail: dto.guestEmail,
          responseStatus: status,
        },
      });

      return {
        statusCode: 201,
        payload: this.toAttendeeResponse(createdAttendee),
      };
    }

    const updatedAttendee = await this.prisma.client.eventAttendee.update({
      where: { id: existingAttendee.id },
      data: {
        guestName: dto.guestName,
        responseStatus: status,
      },
    });

    return {
      statusCode: 200,
      payload: this.toAttendeeResponse(updatedAttendee),
    };
  }

  private toOrganizerResponse(link: {
    eventId: string;
    token: string;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  }) {
    const inviteUrl = this.getInviteBaseUrl();

    return {
      eventId: link.eventId,
      token: link.token,
      url: buildInviteUrl(inviteUrl, link.token),
      isActive: link.isActive,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      createdAt: link.createdAt.toISOString(),
    };
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
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      guestName: attendee.guestName,
      guestEmail: attendee.guestEmail,
      status: this.toApiStatus(attendee.responseStatus),
      createdAt: attendee.createdAt.toISOString(),
      updatedAt: attendee.updatedAt.toISOString(),
    };
  }

  private async getRsvpSummary(eventId: string) {
    const grouped = await this.prisma.client.eventAttendee.groupBy({
      by: ['responseStatus'],
      where: { eventId },
      _count: { _all: true },
    });

    const summary = {
      going: 0,
      maybe: 0,
      notGoing: 0,
      total: 0,
    };

    for (const row of grouped) {
      if (row.responseStatus === AttendeeResponseStatus.GOING) {
        summary.going = row._count._all;
      } else if (row.responseStatus === AttendeeResponseStatus.MAYBE) {
        summary.maybe = row._count._all;
      } else if (row.responseStatus === AttendeeResponseStatus.NOT_GOING) {
        summary.notGoing = row._count._all;
      }
    }

    summary.total = summary.going + summary.maybe + summary.notGoing;
    return summary;
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private getInviteBaseUrl(): string {
    const rawBaseUrl = process.env.PUBLIC_INVITE_BASE_URL;
    if (!rawBaseUrl || rawBaseUrl.trim().length === 0) {
      throw new Error('PUBLIC_INVITE_BASE_URL must be a non-empty string');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawBaseUrl);
    } catch {
      throw new Error('PUBLIC_INVITE_BASE_URL must be a valid absolute URL');
    }

    return parsed.toString().replace(/\/+$/, '');
  }
}
