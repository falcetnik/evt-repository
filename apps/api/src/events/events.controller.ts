import { Controller, Get, Headers, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { RsvpService } from '../invite-links/rsvp.service';

@Controller('v1/events')
export class EventsController {
  constructor(private readonly rsvpService: RsvpService) {}

  @Get(':eventId/attendees')
  @ApiParam({ name: 'eventId' })
  @ApiHeader({ name: 'x-dev-user-id', required: true })
  @ApiOkResponse({ description: 'Organizer attendee list with attendanceState, waitlistPosition, and summary.' })
  async getAttendees(@Param('eventId') eventId: string, @Headers('x-dev-user-id') userId?: string) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const result = await this.rsvpService.getOrganizerAttendees(eventId, userId);
    if (result && "unauthorized" in result) {
      throw new UnauthorizedException();
    }

    if (!result) {
      throw new NotFoundException();
    }

    return result;
  }
}
