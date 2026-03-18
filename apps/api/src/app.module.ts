import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { InviteLinksController } from './invite-links/invite-links.controller';
import { InviteLinksService } from './invite-links/invite-links.service';
import { DevAuthService } from './auth/dev-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, InviteLinksController],
  providers: [InviteLinksService, DevAuthService],
})
export class AppModule {}
