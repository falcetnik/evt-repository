import { Body, Controller, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { RsvpService } from './rsvp.service';

class SubmitRsvpDto {
  guestName!: string;
  guestEmail!: string;
  status!: 'going' | 'maybe' | 'not_going';
}

@Controller('v1/invite-links')
export class InviteLinksController {
  constructor(private readonly rsvpService: RsvpService) {}

  @Get(':token')
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ description: 'Resolve invite link and RSVP summary including waitlist/capacity fields.' })
  async getInviteLink(@Param('token') token: string) {
    const result = await this.rsvpService.resolveInviteToken(token);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }

  @Post(':token/rsvp')
  @ApiParam({ name: 'token' })
  @ApiBody({ type: SubmitRsvpDto })
  @ApiOkResponse({ description: 'Submit RSVP and return placement state with waitlistPosition.' })
  async submitRsvp(@Param('token') token: string, @Body() body: SubmitRsvpDto, @Res({ passthrough: true }) res: { status(code: number): void }) {
    const result = await this.rsvpService.submitRsvp(token, body);
    res.status(result.created ? 201 : 200);
    return result.attendee;
  }
}
