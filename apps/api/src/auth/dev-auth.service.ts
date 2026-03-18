import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DevAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async requireDevUserId(rawUserId: string | undefined): Promise<string> {
    if (!rawUserId) {
      throw new UnauthorizedException('Missing x-dev-user-id');
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: rawUserId } });

    if (!user) {
      throw new UnauthorizedException('Unknown x-dev-user-id');
    }

    return user.id;
  }
}
