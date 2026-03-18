import { Injectable, NotFoundException } from '@nestjs/common';
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
}
