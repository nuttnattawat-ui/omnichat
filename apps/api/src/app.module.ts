import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { InboxesModule } from './modules/inboxes/inboxes.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ChatGatewayModule } from './gateway/chat-gateway.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';

function buildRedisConfig() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };
  }

  const url = new URL(redisUrl);
  const config: Record<string, unknown> = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    maxRetriesPerRequest: null,
  };

  if (url.password) config.password = url.password;
  if (url.username && url.username !== 'default') config.username = url.username;
  if (url.protocol === 'rediss:') config.tls = {};

  console.log(`[Redis] Connecting to ${url.hostname}:${url.port} (TLS: ${url.protocol === 'rediss:'})`);
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: buildRedisConfig(),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    InboxesModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    WebhooksModule,
    SettingsModule,
    ChatGatewayModule,
    AiModule,
  ],
})
export class AppModule {}
