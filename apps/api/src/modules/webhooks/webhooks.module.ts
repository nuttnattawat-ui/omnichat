import { Module } from '@nestjs/common';
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
import { ChatGatewayModule } from '../../gateway/chat-gateway.module';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    AiModule,
    ChatGatewayModule,
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
