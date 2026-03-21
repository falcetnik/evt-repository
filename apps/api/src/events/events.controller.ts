import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { ReplaceEventRemindersDto } from './dto/replace-event-reminders.dto';
import { ListEventsQueryDto } from './dto/list-events.query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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


  @Get()
  @ApiOperation({ summary: 'List organizer events for home screen cards' })
  @ApiQuery({ name: 'scope', required: false, enum: ['upcoming', 'past', 'all'], description: 'Defaults to upcoming' })
  @ApiResponse({ status: 200, description: 'Organizer events loaded' })
  @ApiResponse({ status: 400, description: 'Invalid scope query value' })
  @ApiResponse({ status: 401, description: 'Unauthorized organizer' })
  listEvents(@CurrentUser() currentUser: AuthUser, @Query() query: ListEventsQueryDto) {
    return this.eventsService.listEvents(currentUser, query.scope);
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Get organizer event by id' })
  @ApiResponse({ status: 200, description: 'Event loaded' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getEventById(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getEventById(currentUser, eventId);
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Update organizer event by id' })
  @ApiBody({ type: UpdateEventDto })
  @ApiResponse({ status: 200, description: 'Event updated' })
  @ApiResponse({ status: 400, description: 'Invalid payload or unsafe event update' })
  @ApiResponse({ status: 401, description: 'Unauthorized organizer' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  updateEvent(
    @CurrentUser() currentUser: AuthUser,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(currentUser, eventId, dto);
  }

  @Get(':eventId/attendees')
  @ApiOperation({ summary: 'Get organizer attendee list for event' })
  @ApiResponse({ status: 200, description: 'Attendees loaded with attendanceState, waitlistPosition, and capacity-aware summary' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getAttendees(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getAttendees(currentUser, eventId);
  }

  @Get(':eventId/invite-link')
  @ApiOperation({ summary: 'Get current usable organizer invite link for event' })
  @ApiResponse({ status: 200, description: 'Current usable invite link or null loaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized organizer' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getCurrentInviteLink(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getCurrentInviteLink(currentUser, eventId);
  }

  @Put(':eventId/reminders')
  @ApiOperation({ summary: 'Replace organizer reminder schedule for event' })
  @ApiBody({ type: ReplaceEventRemindersDto })
  @ApiResponse({ status: 200, description: 'Reminder schedule replaced' })
  @ApiResponse({ status: 400, description: 'Validation or reminder timing failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized organizer' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  replaceEventReminders(
    @CurrentUser() currentUser: AuthUser,
    @Param('eventId') eventId: string,
    @Body() dto: ReplaceEventRemindersDto,
  ) {
    return this.eventsService.replaceEventReminders(currentUser, eventId, dto.offsetsMinutes);
  }

  @Get(':eventId/reminders')
  @ApiOperation({ summary: 'Read organizer reminder schedule for event' })
  @ApiResponse({ status: 200, description: 'Reminder schedule loaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized organizer' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getEventReminders(@CurrentUser() currentUser: AuthUser, @Param('eventId') eventId: string) {
    return this.eventsService.getEventReminders(currentUser, eventId);
  }
}
