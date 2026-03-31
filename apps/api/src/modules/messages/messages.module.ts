import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';

@Module({
  providers: [MessagesService, LineAdapter, FacebookAdapter],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
