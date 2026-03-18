import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { buildInviteUrl } from './invite-link-url';

type InviteLinkPayload = {
  eventId: string;
  token: string;
  url: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

@Injectable()
export class InviteLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private isUsable(link: { isActive: boolean; expiresAt: Date | null }): boolean {
    return link.isActive && (!link.expiresAt || link.expiresAt > new Date());
  }

  private toOrganizerPayload(baseUrl: string, link: { eventId: string; token: string; isActive: boolean; expiresAt: Date | null; createdAt: Date }): InviteLinkPayload {
    return {
      eventId: link.eventId,
      token: link.token,
      url: buildInviteUrl(baseUrl, link.token),
      isActive: link.isActive,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      createdAt: link.createdAt.toISOString(),
    };
  }

  async createOrGetActiveInviteLink(eventId: string, baseUrl: string): Promise<{ statusCode: 200 | 201; payload: InviteLinkPayload }> {
    const usableLink = await this.prisma.client.inviteLink.findFirst({
      where: {
        eventId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (usableLink && this.isUsable(usableLink)) {
      return {
        statusCode: 200,
        payload: this.toOrganizerPayload(baseUrl, usableLink),
      };
    }

    const created = await this.createInviteLinkWithUniqueToken(eventId);

    return {
      statusCode: 201,
      payload: this.toOrganizerPayload(baseUrl, created),
    };
  }

  async resolvePublicInvite(token: string, baseUrl: string) {
    const inviteLink = await this.prisma.client.inviteLink.findUnique({
      where: { token },
      include: { event: true },
    });

    if (!inviteLink || !inviteLink.event || !this.isUsable(inviteLink)) {
      return null;
    }

    return {
      token: inviteLink.token,
      url: buildInviteUrl(baseUrl, inviteLink.token),
      expiresAt: inviteLink.expiresAt ? inviteLink.expiresAt.toISOString() : null,
      event: {
        title: inviteLink.event.title,
        description: inviteLink.event.description,
        location: inviteLink.event.locationAddress,
        startsAt: inviteLink.event.startsAt.toISOString(),
        timezone: inviteLink.event.timezone,
        capacityLimit: inviteLink.event.capacityLimit,
        allowPlusOnes: inviteLink.event.allowPlusOnes,
      },
    };
  }

  private async createInviteLinkWithUniqueToken(eventId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = this.generateSecureToken();

      try {
        return await this.prisma.client.inviteLink.create({
          data: {
            eventId,
            token,
            isActive: true,
            expiresAt: null,
          },
        });
      } catch (error) {
        const isDuplicateToken =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';

        if (!isDuplicateToken) {
          throw error;
        }
      }
    }

    throw new Error('Failed to generate a unique invite token');
  }

  private generateSecureToken() {
    return randomBytes(32).toString('base64url');
  }
}
