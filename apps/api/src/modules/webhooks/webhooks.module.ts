import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MessageProcessor } from '../../jobs/message.processor';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';
import { InstagramAdapter } from '../../adapters/instagram.adapter';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { ContactsModule } from '../contacts/contacts.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'messages' }),
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    AiModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    MessageProcessor,
    LineAdapter,
    FacebookAdapter,
    InstagramAdapter,
  ],
})
export class WebhooksModule {}
