import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../database/prisma.service';
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

    const inviteUrl = this.getInviteBaseUrl();

    return {
      token: link.token,
      url: buildInviteUrl(inviteUrl, link.token),
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
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
