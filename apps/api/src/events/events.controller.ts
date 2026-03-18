import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('v1/events')
@UseGuards(DevAuthGuard)
@ApiHeader({ name: 'x-dev-user-id', required: true, description: 'Development/test organizer user ID' })
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create organizer event' })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: 'Event created' })
  createEvent(@CurrentUser() currentUser: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(currentUser, dto);
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Get organizer event by id' })
  @ApiResponse({ status: 200, description: 'Event loaded' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getEventById(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getEventById(currentUser, eventId);
  }

  @Get(':eventId/attendees')
  @ApiOperation({ summary: 'Get organizer attendee list for event' })
  @ApiResponse({ status: 200, description: 'Attendees loaded' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getAttendees(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getAttendees(currentUser, eventId);
  }
}
