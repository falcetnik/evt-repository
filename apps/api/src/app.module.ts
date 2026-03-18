import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { InviteLinksController } from './invite-links/invite-links.controller';
import { EventsController } from './events/events.controller';
import { RsvpService } from './invite-links/rsvp.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, InviteLinksController, EventsController],
  providers: [RsvpService],
})
export class AppModule {}
