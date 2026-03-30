import { Module } from '@nestjs/common';
import { InboxesService } from './inboxes.service';
import { InboxesController } from './inboxes.controller';

@Module({
  providers: [InboxesService],
  controllers: [InboxesController],
  exports: [InboxesService],
})
export class InboxesModule {}
