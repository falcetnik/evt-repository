import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type RequestWithDevUser = Request & {
  headers: Record<string, string | string[] | undefined>;
  devUserId?: string;
};

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithDevUser>();
    const rawHeader = request.headers['x-dev-user-id'];
    const devUserId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!devUserId || devUserId.trim().length === 0) {
      throw new UnauthorizedException('Missing x-dev-user-id header');
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: devUserId } });
    if (!user) {
      throw new UnauthorizedException('Unknown x-dev-user-id');
    }

    request.devUserId = devUserId;
    return true;
  }
}
