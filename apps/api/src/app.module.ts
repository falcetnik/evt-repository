import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DevAuthGuard } from './auth/dev-auth.guard';
import { PrismaModule } from './database/prisma.module';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { InviteLinksController } from './invite-links/invite-links.controller';
import { InviteLinksService } from './invite-links/invite-links.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, InviteLinksController, EventsController],
  providers: [InviteLinksService, EventsService, DevAuthGuard],
})
export class AppModule {}
