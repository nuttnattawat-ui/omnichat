import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NormalizedMessage } from '../common/interfaces/normalized-message.interface';
import { ChatGateway } from '../gateway/chat.gateway';
import { AiService } from '../modules/ai/ai.service';
import { MessagesService } from '../modules/messages/messages.service';
import { LineAdapter } from '../adapters/line.adapter';

@Injectable()
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly aiService: AiService,
    private readonly messagesService: MessagesService,
    private readonly lineAdapter: LineAdapter,
  ) {}

  async handleIncomingMessage(job: { data: NormalizedMessage }) {
    const msg = job.data;
    this.logger.log(
      `Processing ${msg.channel} message: ${msg.platformMessageId}`,
    );

    // 1. Find or create inbox
    const inbox = await this.prisma.inbox.findFirst({
      where: { channelType: msg.channel, enabled: true },
    });

    if (!inbox) {
      this.logger.warn(`No active inbox for channel: ${msg.channel}`);
      return;
    }

    // 2. Dedup check
    const existing = await this.prisma.message.findUnique({
      where: {
        sourceId_inboxId: {
          sourceId: msg.platformMessageId,
          inboxId: inbox.id,
        },
      },
    });

    if (existing) {
      this.logger.warn(`Duplicate message: ${msg.platformMessageId}`);
      return;
    }

    // 3. Find or create contact
    let contactInbox = await this.prisma.contactInbox.findUnique({
      where: {
        inboxId_sourceId: {
          inboxId: inbox.id,
          sourceId: msg.sender.platformId,
        },
      },
      include: { contact: true },
    });

    if (!contactInbox) {
      let displayName = msg.sender.displayName || `${msg.channel} user`;
      let avatarUrl = msg.sender.avatarUrl;

      // Fetch real profile from LINE API when creating a new contact
      if (msg.channel === 'line') {
        try {
          const channelConfig = inbox.channelConfig as Record<string, string>;
          const profile = await this.lineAdapter.getUserProfile(
            channelConfig.channelAccessToken,
            msg.sender.platformId,
          );
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        } catch (err) {
          this.logger.warn(
            `Failed to fetch LINE profile for ${msg.sender.platformId}: ${err}`,
          );
        }
      }

      const contact = await this.prisma.contact.create({
        data: {
          accountId: inbox.accountId,
          name: displayName,
          avatarUrl,
        },
      });

      contactInbox = await this.prisma.contactInbox.create({
        data: {
          contactId: contact.id,
          inboxId: inbox.id,
          sourceId: msg.sender.platformId,
        },
        include: { contact: true },
      });
    }

    // 3.5 Update existing contact profile if missing (for contacts created before profile fetch)
    if (contactInbox.contact && msg.channel === 'line') {
      const contact = contactInbox.contact;
      if (!contact.avatarUrl || contact.name === 'line user' || contact.name?.endsWith(' user')) {
        try {
          const channelConfig = inbox.channelConfig as Record<string, string>;
          const profile = await this.lineAdapter.getUserProfile(
            channelConfig.channelAccessToken,
            msg.sender.platformId,
          );
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: {
              name: profile.displayName,
              avatarUrl: profile.pictureUrl,
            },
          });
          contactInbox.contact.name = profile.displayName;
          contactInbox.contact.avatarUrl = profile.pictureUrl ?? null;
          this.logger.log(`Updated LINE profile for contact ${contact.id}: ${profile.displayName}`);
        } catch (err) {
          this.logger.warn(`Failed to update LINE profile: ${err}`);
        }
      }
    }

    // 4. Find or create conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        inboxId: inbox.id,
        contactId: contactInbox.contactId,
        status: { in: ['open', 'pending'] },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          accountId: inbox.accountId,
          inboxId: inbox.id,
          contactId: contactInbox.contactId,
          status: 'open',
        },
      });
    }

    // 5. Save message
    const savedMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        accountId: inbox.accountId,
        inboxId: inbox.id,
        messageType: 'incoming',
        content: msg.content,
        contentType: msg.contentType,
        contentAttributes: JSON.parse(JSON.stringify(msg.contentAttributes ?? {})),
        sourceId: msg.platformMessageId,
        senderId: contactInbox.contactId,
        senderType: 'Contact',
      },
    });

    // 6. Update conversation
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastActivityAt: new Date(),
        waitingSince: new Date(),
        messagesCount: { increment: 1 },
      },
    });

    // 6.5 Store replyToken for quick replies (LINE)
    if (msg.replyToken) {
      this.messagesService.storeReplyToken(conversation.id, msg.replyToken);
    }

    // 7. Broadcast via WebSocket
    this.chatGateway.broadcastMessage(conversation.id, {
      ...savedMessage,
      senderName: contactInbox.contact.name,
      channel: msg.channel,
    });

    // 8. AI auto-reply if enabled
    if (inbox.aiEnabled && msg.contentType === 'text') {
      await this.aiService.handleAutoReply(
        conversation.id,
        inbox,
        msg,
      );
    }

    this.logger.log(
      `Message saved: conv=${conversation.id} msg=${savedMessage.id}`,
    );
  }
}
