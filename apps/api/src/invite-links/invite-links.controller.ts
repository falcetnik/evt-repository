import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicRsvpDto } from '../rsvp/dto/public-rsvp.dto';
import { InviteLinksService } from './invite-links.service';

@ApiTags('invite-links')
@Controller('v1/invite-links')
export class InviteLinksController {
  constructor(private readonly inviteLinksService: InviteLinksService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resolve a public invite link with RSVP summary counts' })
  async getPublicInvite(@Param('token') token: string) {
    return this.inviteLinksService.getPublicInvite(token);
  }

  @Post(':token/rsvp')
  @ApiOperation({ summary: 'Submit or update RSVP via public invite link token' })
  async submitRsvp(
    @Param('token') token: string,
    @Body() body: PublicRsvpDto,
    @Res({ passthrough: true }) response: { status: (code: number) => void },
  ) {
    const result = await this.inviteLinksService.submitPublicRsvp(token, body);

    response.status(result.created ? 201 : 200);
    return result.attendee;
  }
}
