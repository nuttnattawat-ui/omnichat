import { Injectable, Logger } from '@nestjs/common';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';
import { InstagramAdapter } from '../../adapters/instagram.adapter';
import { MessageProcessor } from '../../jobs/message.processor';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
    private readonly instagramAdapter: InstagramAdapter,
    private readonly messageProcessor: MessageProcessor,
  ) {}

  async handleLineWebhook(
    body: Record<string, unknown>,
    _signature: string,
  ) {
    const messages = this.lineAdapter.parseWebhook(body);
    this.logger.log(`Parsed ${messages.length} LINE messages`);

    for (const msg of messages) {
      try {
        await this.messageProcessor.handleIncomingMessage({ data: msg } as any);
        this.logger.log(`Processed LINE message: ${msg.platformMessageId}`);
      } catch (err) {
        this.logger.error(`Failed to process message: ${err}`);
      }
    }
  }

  async handleFacebookWebhook(
    body: Record<string, unknown>,
    _signature: string,
  ) {
    const messages = this.facebookAdapter.parseWebhook(body);
    this.logger.log(`Parsed ${messages.length} Facebook messages`);

    for (const msg of messages) {
      try {
        await this.messageProcessor.handleIncomingMessage({ data: msg } as any);
        this.logger.log(`Processed Facebook message: ${msg.platformMessageId}`);
      } catch (err) {
        this.logger.error(`Failed to process message: ${err}`);
      }
    }
  }

  async handleInstagramWebhook(
    body: Record<string, unknown>,
    _signature: string,
  ) {
    const messages = this.instagramAdapter.parseWebhook(body);
    this.logger.log(`Parsed ${messages.length} Instagram messages`);

    for (const msg of messages) {
      try {
        await this.messageProcessor.handleIncomingMessage({ data: msg } as any);
        this.logger.log(`Processed Instagram message: ${msg.platformMessageId}`);
      } catch (err) {
        this.logger.error(`Failed to process message: ${err}`);
      }
    }
  }
}
