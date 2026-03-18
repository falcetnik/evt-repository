import { Module } from '@nestjs/common';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, DevAuthGuard],
})
export class EventsModule {}
