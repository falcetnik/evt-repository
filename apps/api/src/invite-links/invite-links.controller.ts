import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevAuthService } from '../auth/dev-auth.service';
import { PrismaService } from '../database/prisma.service';
import { InviteLinksService } from './invite-links.service';

@ApiTags('invite-links')
@Controller('v1')
export class InviteLinksController {
  constructor(
    private readonly devAuthService: DevAuthService,
    private readonly prisma: PrismaService,
    private readonly inviteLinksService: InviteLinksService,
  ) {}

  @Post('events/:eventId/invite-link')
  @ApiOperation({ summary: 'Create or fetch active invite link for organizer event' })
  @ApiHeader({ name: 'x-dev-user-id', required: true, description: 'Development/test organizer user id' })
  @ApiResponse({ status: 201, description: 'Invite link created' })
  @ApiResponse({ status: 200, description: 'Existing active invite link returned' })
  @ApiResponse({ status: 401, description: 'Missing or unknown x-dev-user-id' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async createOrFetchInviteLink(
    @Param('eventId') eventId: string,
    @Headers('x-dev-user-id') devUserId: string | undefined,
    @Res({ passthrough: true }) res: any,
  ) {
    const userId = await this.devAuthService.requireDevUserId(devUserId);

    const event = await this.prisma.client.event.findFirst({
      where: { id: eventId, organizerUserId: userId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const baseUrl = process.env.PUBLIC_INVITE_BASE_URL as string;
    const { statusCode, payload } = await this.inviteLinksService.createOrGetActiveInviteLink(event.id, baseUrl);

    return res.status(statusCode).json(payload);
  }

  @Get('invite-links/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve public invite link token' })
  @ApiResponse({ status: 200, description: 'Invite link resolved to public event payload' })
  @ApiResponse({ status: 404, description: 'Invite link not found' })
  async resolvePublicInviteLink(@Param('token') token: string) {
    const baseUrl = process.env.PUBLIC_INVITE_BASE_URL as string;
    const payload = await this.inviteLinksService.resolvePublicInvite(token, baseUrl);

    if (!payload) {
      throw new NotFoundException('Invite link not found');
    }

    return payload;
  }
}
