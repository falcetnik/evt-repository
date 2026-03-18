import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevUserId } from '../auth/dev-user-id.decorator';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':eventId/attendees')
  @UseGuards(DevAuthGuard)
  @ApiHeader({ name: 'x-dev-user-id', required: true, description: 'Development auth organizer id' })
  @ApiOperation({ summary: 'List attendees and RSVP summary for organizer-owned event' })
  async getAttendees(@Param('eventId') eventId: string, @DevUserId() devUserId: string) {
    return this.eventsService.getAttendeesForOrganizer(eventId, devUserId);
  }
}
