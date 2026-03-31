import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';
import { InstagramAdapter } from '../../adapters/instagram.adapter';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectQueue('messages') private readonly messagesQueue: Queue,
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
    private readonly instagramAdapter: InstagramAdapter,
  ) {}

  async handleLineWebhook(
    body: Record<string, unknown>,
    _signature: string,
  ) {
    // TODO: validate signature with raw body (needs raw body middleware)
    const messages = this.lineAdapter.parseWebhook(body);
    this.logger.log(`Parsed ${messages.length} LINE messages`);

    for (const msg of messages) {
      try {
        await this.messagesQueue.add('process-incoming', msg, {
          removeOnComplete: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Queued LINE message: ${msg.platformMessageId}`);
      } catch (err) {
        this.logger.error(`Failed to queue message: ${err}`);
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
      await this.messagesQueue.add('process-incoming', msg, {
        removeOnComplete: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
    }
  }

  async handleInstagramWebhook(
    body: Record<string, unknown>,
    _signature: string,
  ) {
    const messages = this.instagramAdapter.parseWebhook(body);
    this.logger.log(`Parsed ${messages.length} Instagram messages`);

    for (const msg of messages) {
      await this.messagesQueue.add('process-incoming', msg, {
        removeOnComplete: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
    }
  }
}
