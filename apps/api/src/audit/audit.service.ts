import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { getRequestId } from '../observability/request-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logOrganizerAction(params: {
    actorUserId: string;
    action: string;
    entityType: 'event';
    entityId: string;
    metadata: Record<string, unknown>;
  }) {
    await this.logAction({
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    });
  }

  async logAction(params: {
    actorUserId: string | null;
    action: string;
    entityType: 'event';
    entityId: string;
    metadata: Record<string, unknown>;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma.client;
    await client.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        requestId: getRequestId() ?? 'unknown',
        metadataJson: params.metadata as never,
      },
    });
  }
}
