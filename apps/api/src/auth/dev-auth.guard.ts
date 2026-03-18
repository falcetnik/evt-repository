import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; currentUser?: unknown }>();

    const appEnv = process.env.APP_ENV ?? 'development';
    if (!['development', 'test'].includes(appEnv)) {
      throw new UnauthorizedException('Dev auth is only available in development and test environments');
    }

    const rawHeader = request.headers['x-dev-user-id'];
    const userId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!userId || userId.trim().length === 0) {
      throw new UnauthorizedException('Missing x-dev-user-id header');
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Unknown x-dev-user-id user');
    }

    request.currentUser = user;
    return true;
  }
}
