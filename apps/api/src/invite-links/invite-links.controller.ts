import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { InviteLinksService } from './invite-links.service';

@ApiTags('invite-links')
@Controller('v1')
export class InviteLinksController {
  constructor(private readonly inviteLinksService: InviteLinksService) {}

  @Post('events/:eventId/invite-link')
  @UseGuards(DevAuthGuard)
  @ApiHeader({ name: 'x-dev-user-id', required: true, description: 'Development/test organizer user ID' })
  @ApiOperation({ summary: 'Create or fetch active invite link for organizer event' })
  @ApiParam({ name: 'eventId', required: true })
  @ApiResponse({ status: 201, description: 'Invite link created' })
  @ApiResponse({ status: 200, description: 'Active invite link returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async createOrGetInviteLink(
    @CurrentUser() currentUser: AuthUser,
    @Param('eventId') eventId: string,
    @Res() response: { status: (statusCode: number) => { json: (body: unknown) => unknown } },
  ) {
    const result = await this.inviteLinksService.createOrGetInviteLink(currentUser, eventId);
    return response.status(result.statusCode).json(result.payload);
  }

  @Get('invite-links/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a public invite token to public event data' })
  @ApiParam({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Public invite resolved' })
  @ApiResponse({ status: 404, description: 'Invite link not found' })
  resolveInviteLink(@Param('token') token: string) {
    return this.inviteLinksService.resolvePublicInviteLink(token);
  }
}
