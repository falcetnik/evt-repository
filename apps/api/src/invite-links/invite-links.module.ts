import { Module } from '@nestjs/common';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { InviteLinksController } from './invite-links.controller';
import { InviteLinksService } from './invite-links.service';

@Module({
  controllers: [InviteLinksController],
  providers: [InviteLinksService, DevAuthGuard],
})
export class InviteLinksModule {}
