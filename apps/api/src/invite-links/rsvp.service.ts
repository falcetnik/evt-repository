import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeResponseStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  buildRsvpSummary,
  deriveAttendanceState,
  sortAttendeeRecords,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../attendees/attendance.utils';

type SubmitRsvpBody = {
  guestName: string;
  guestEmail: string;
  status: 'going' | 'maybe' | 'not_going';
};

const toApiStatus = (status: AttendeeResponseStatus) => status.toLowerCase();

const toDbStatus = (status: SubmitRsvpBody['status']): AttendeeResponseStatus => {
  if (status === 'going') return AttendeeResponseStatus.GOING;
  if (status === 'maybe') return AttendeeResponseStatus.MAYBE;
  return AttendeeResponseStatus.NOT_GOING;
};

@Injectable()
export class RsvpService {
  constructor(private readonly prisma: PrismaService) {}

  private toAttendeeResponse(attendee: {
    id: string;
    eventId: string;
    guestName: string | null;
    guestEmail: string | null;
    responseStatus: AttendeeResponseStatus;
    waitlistPosition: number | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      attendeeId: attendee.id,
      eventId: attendee.eventId,
      guestName: attendee.guestName,
      guestEmail: attendee.guestEmail,
      status: toApiStatus(attendee.responseStatus),
      attendanceState: deriveAttendanceState(attendee.responseStatus as AttendanceStatus, attendee.waitlistPosition),
      waitlistPosition: attendee.waitlistPosition,
      createdAt: attendee.createdAt.toISOString(),
      updatedAt: attendee.updatedAt.toISOString(),
    };
  }

  private validateBody(body: SubmitRsvpBody) {
    if (!body?.guestName?.trim() || !body?.guestEmail?.trim()) {
      throw new BadRequestException('guestName and guestEmail are required');
    }

    if (!['going', 'maybe', 'not_going'].includes(body.status)) {
      throw new BadRequestException('invalid status');
    }
  }

  async submitRsvp(token: string, body: SubmitRsvpBody) {
    this.validateBody(body);

    return this.prisma.client.$transaction(async (tx) => {
      const invite = await tx.inviteLink.findUnique({ where: { token }, include: { event: true } });

      if (!invite || !invite.isActive || (invite.expiresAt && invite.expiresAt < new Date())) {
        throw new NotFoundException();
      }

      await tx.$queryRaw`SELECT id FROM events WHERE id = ${invite.eventId} FOR UPDATE`;

      const normalizedEmail = body.guestEmail.trim().toLowerCase();
      const dbStatus = toDbStatus(body.status);
      const now = new Date();

      const existing = await tx.eventAttendee.findFirst({
        where: { eventId: invite.eventId, guestEmail: normalizedEmail },
      });

      let current = existing;
      if (existing) {
        current = await tx.eventAttendee.update({
          where: { id: existing.id },
          data: {
            guestName: body.guestName.trim(),
            guestEmail: normalizedEmail,
            responseStatus: dbStatus,
            waitlistPosition: dbStatus === AttendeeResponseStatus.GOING ? existing.waitlistPosition : null,
            updatedAt: now,
          },
        });
      } else {
        current = await tx.eventAttendee.create({
          data: {
            eventId: invite.eventId,
            guestName: body.guestName.trim(),
            guestEmail: normalizedEmail,
            responseStatus: dbStatus,
            waitlistPosition: null,
            updatedAt: now,
          },
        });
      }

      const attendees = await tx.eventAttendee.findMany({ where: { eventId: invite.eventId } });
      const attendeeById = new Map(attendees.map((attendee) => [attendee.id, attendee]));

      const confirmed = attendees
        .filter((attendee) => attendee.responseStatus === AttendeeResponseStatus.GOING && attendee.waitlistPosition === null)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
        .map((attendee) => attendee.id);

      const waitlisted = attendees
        .filter((attendee) => attendee.responseStatus === AttendeeResponseStatus.GOING && attendee.waitlistPosition !== null)
        .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.id.localeCompare(b.id))
        .map((attendee) => attendee.id);

      const capacity = invite.event.capacityLimit;
      const maxConfirmed = capacity === null ? Number.MAX_SAFE_INTEGER : capacity;

      while (confirmed.length > maxConfirmed) {
        const demoted = confirmed.pop();
        if (demoted) {
          waitlisted.unshift(demoted);
        }
      }

      while (confirmed.length < maxConfirmed && waitlisted.length > 0) {
        const promoted = waitlisted.shift();
        if (promoted) {
          confirmed.push(promoted);
        }
      }

      const confirmedSet = new Set(confirmed);
      const waitlistedPositions = new Map<string, number>();
      waitlisted.forEach((attendeeId, index) => waitlistedPositions.set(attendeeId, index + 1));

      for (const attendee of attendees) {
        let nextWaitlistPosition: number | null = null;

        if (attendee.responseStatus === AttendeeResponseStatus.GOING) {
          nextWaitlistPosition = confirmedSet.has(attendee.id) ? null : (waitlistedPositions.get(attendee.id) ?? null);
        }

        if (attendee.waitlistPosition !== nextWaitlistPosition) {
          await tx.eventAttendee.update({
            where: { id: attendee.id },
            data: {
              waitlistPosition: nextWaitlistPosition,
              updatedAt: now,
            },
          });
        }
      }

      if (current.responseStatus !== AttendeeResponseStatus.GOING && current.waitlistPosition !== null) {
        await tx.eventAttendee.update({ where: { id: current.id }, data: { waitlistPosition: null, updatedAt: now } });
      }

      const finalAttendee = await tx.eventAttendee.findUniqueOrThrow({ where: { id: current.id } });

      return {
        created: !existing,
        attendee: this.toAttendeeResponse(finalAttendee),
      };
    });
  }

  async resolveInviteToken(token: string) {
    const invite = await this.prisma.client.inviteLink.findUnique({ where: { token }, include: { event: true } });

    if (!invite || !invite.isActive || (invite.expiresAt && invite.expiresAt < new Date())) {
      return null;
    }

    const attendees = await this.prisma.client.eventAttendee.findMany({ where: { eventId: invite.eventId } });
    const summary = buildRsvpSummary(
      attendees.map((attendee) => ({
        id: attendee.id,
        status: attendee.responseStatus as AttendanceStatus,
        waitlistPosition: attendee.waitlistPosition,
        createdAt: attendee.createdAt,
      })),
      invite.event.capacityLimit,
    );

    return {
      eventId: invite.event.id,
      title: invite.event.title,
      startsAt: invite.event.startsAt.toISOString(),
      timezone: invite.event.timezone,
      rsvpSummary: summary,
    };
  }

  async getOrganizerAttendees(eventId: string, userId: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { unauthorized: true as const };
    }

    const event = await this.prisma.client.event.findFirst({ where: { id: eventId, organizerUserId: userId } });
    if (!event) {
      return null;
    }

    const attendees = await this.prisma.client.eventAttendee.findMany({ where: { eventId } });

    const sorted = sortAttendeeRecords(
      attendees.map((attendee) => ({
        id: attendee.id,
        status: attendee.responseStatus as AttendanceStatus,
        waitlistPosition: attendee.waitlistPosition,
        createdAt: attendee.createdAt,
      })),
    );

    const attendeeMap = new Map(attendees.map((attendee) => [attendee.id, attendee]));

    return {
      eventId,
      summary: buildRsvpSummary(
        attendees.map((attendee) => ({
          id: attendee.id,
          status: attendee.responseStatus as AttendanceStatus,
          waitlistPosition: attendee.waitlistPosition,
          createdAt: attendee.createdAt,
        })),
        event.capacityLimit,
      ),
      attendees: sorted.map((row) => this.toAttendeeResponse(attendeeMap.get(row.id)!)),
    };
  }
}
