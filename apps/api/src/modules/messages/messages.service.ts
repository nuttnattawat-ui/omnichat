import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  // In-memory cache of replyTokens (conversationId -> { token, timestamp })
  private replyTokens = new Map<number, { token: string; timestamp: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
  ) {}

  /** Called by MessageProcessor to store replyToken for later use */
  storeReplyToken(conversationId: number, replyToken: string) {
    this.replyTokens.set(conversationId, {
      token: replyToken,
      timestamp: Date.now(),
    });
  }

  /** Get replyToken if still valid (within 30 seconds to be safe) */
  private getReplyToken(conversationId: number): string | undefined {
    const entry = this.replyTokens.get(conversationId);
    if (!entry) return undefined;

    const ageMs = Date.now() - entry.timestamp;
    if (ageMs > 30_000) {
      // Expired (LINE gives ~1 min but we use 30s to be safe)
      this.replyTokens.delete(conversationId);
      return undefined;
    }

    // Use once then delete
    this.replyTokens.delete(conversationId);
    return entry.token;
  }

  async findByConversation(conversationId: number, page = 1, limit = 50) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        senderUser: { select: { name: true } },
      },
    });

    return messages.map((m) => ({
      ...m,
      senderName: m.senderUser?.name || (m.senderType === 'Contact' ? undefined : undefined),
      senderUser: undefined,
    }));
  }

  async createOutgoing(
    conversationId: number,
    userId: number,
    accountId: number,
    data: { content: string; contentType?: string; private?: boolean; contentAttributes?: Record<string, unknown> },
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, accountId },
      include: { inbox: true },
    });

    if (!conversation) throw new Error('Conversation not found');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        accountId,
        inboxId: conversation.inboxId,
        messageType: data.private ? 'note' : 'outgoing',
        content: data.content,
        contentType: data.contentType || 'text',
        contentAttributes: data.contentAttributes ? JSON.parse(JSON.stringify(data.contentAttributes)) : undefined,
        senderId: userId,
        senderType: 'User',
        private: data.private || false,
      },
    });

    // Update conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastActivityAt: new Date(),
        waitingSince: null,
        messagesCount: { increment: 1 },
        firstReplyAt: conversation.firstReplyAt || new Date(),
      },
    });

    // Get sender name for broadcast
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Broadcast via WebSocket (with sender name)
    this.chatGateway.broadcastMessage(conversationId, {
      ...message,
      senderName: sender?.name || 'Agent',
    });

    // Send to platform (unless it's a private note)
    if (!data.private) {
      const contactInbox = await this.prisma.contactInbox.findFirst({
        where: {
          inboxId: conversation.inboxId,
          contactId: conversation.contactId,
        },
      });

      if (contactInbox) {
        const config = conversation.inbox.channelConfig as Record<string, string>;
        const outgoing = { conversationId, content: data.content, contentType: (data.contentType || 'text') as any, contentAttributes: data.contentAttributes };

        this.logger.log(`Sending ${outgoing.contentType} to ${conversation.inbox.channelType}, recipient=${contactInbox.sourceId}, attrs=${JSON.stringify(data.contentAttributes || {})}`);

        try {
          switch (conversation.inbox.channelType) {
            case 'line': {
              // Try reply first (free), fallback to push
              const replyToken = this.getReplyToken(conversationId);
              if (replyToken) {
                this.logger.log(`Using LINE Reply (free) for conv=${conversationId}`);
              } else {
                this.logger.log(`Using LINE Push for conv=${conversationId}`);
              }
              await this.lineAdapter.sendMessage(config, contactInbox.sourceId, outgoing, replyToken);
              this.logger.log(`Sent LINE ${outgoing.contentType} to ${contactInbox.sourceId}`);
              break;
            }
            case 'facebook':
            case 'instagram':
              await this.facebookAdapter.sendMessage(config, contactInbox.sourceId, outgoing);
              this.logger.log(`Sent ${conversation.inbox.channelType} message to ${contactInbox.sourceId}`);
              break;
          }
        } catch (err) {
          this.logger.error(`Failed to send ${outgoing.contentType} via ${conversation.inbox.channelType}: ${err}`);
        }
      }
    }

    return { ...message, senderName: sender?.name || 'Agent' };
  }
}
