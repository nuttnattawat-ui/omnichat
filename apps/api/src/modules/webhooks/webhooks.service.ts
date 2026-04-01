import { Injectable, Logger } from '@nestjs/common';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';
import { InstagramAdapter } from '../../adapters/instagram.adapter';
import { MessageProcessor } from '../../jobs/message.processor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
    private readonly instagramAdapter: InstagramAdapter,
    private readonly messageProcessor: MessageProcessor,
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
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
    this.logger.log(`Facebook webhook raw: ${JSON.stringify(body).substring(0, 1000)}`);
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

    // Handle read receipts
    const reads = this.facebookAdapter.parseReadReceipts(body);
    for (const read of reads) {
      try {
        await this.processReadReceipt(read.senderId, read.watermark, 'facebook');
      } catch (err) {
        this.logger.error(`Failed to process read receipt: ${err}`);
      }
    }
  }

  /** Process a read receipt — find the conversation and broadcast */
  private async processReadReceipt(senderPlatformId: string, watermark: number, channel: string) {
    const contactInbox = await this.prisma.contactInbox.findFirst({
      where: { sourceId: senderPlatformId },
      include: {
        inbox: { select: { accountId: true } },
      },
    });
    if (!contactInbox) return;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        contactId: contactInbox.contactId,
        inboxId: contactInbox.inboxId,
        status: { in: ['open', 'pending'] },
      },
    });
    if (!conversation) return;

    const readAt = new Date(watermark);
    this.logger.log(`Read receipt: conv=${conversation.id}, sender=${senderPlatformId}, readAt=${readAt.toISOString()}`);

    // Broadcast read event to conversation room
    this.chatGateway.server
      .to(`conversation:${conversation.id}`)
      .emit('message_read', {
        conversationId: conversation.id,
        readAt: readAt.toISOString(),
        channel,
      });
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
