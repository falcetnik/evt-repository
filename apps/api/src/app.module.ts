import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { EventsModule } from './events/events.module';
import { InviteLinksModule } from './invite-links/invite-links.module';

@Module({
  imports: [PrismaModule, EventsModule, InviteLinksModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
