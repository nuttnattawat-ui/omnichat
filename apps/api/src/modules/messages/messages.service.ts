import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
  ) {}

  findByConversation(conversationId: number, page = 1, limit = 50) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async createOutgoing(
    conversationId: number,
    userId: number,
    accountId: number,
    data: { content: string; contentType?: string; private?: boolean },
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

    // Broadcast via WebSocket
    this.chatGateway.broadcastMessage(conversationId, message);

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
        const outgoing = { content: data.content, contentType: (data.contentType || 'text') as any };

        try {
          switch (conversation.inbox.channelType) {
            case 'line':
              await this.lineAdapter.sendMessage(config, contactInbox.sourceId, outgoing);
              this.logger.log(`Sent LINE message to ${contactInbox.sourceId}`);
              break;
            case 'facebook':
            case 'instagram':
              await this.facebookAdapter.sendMessage(config, contactInbox.sourceId, outgoing);
              this.logger.log(`Sent ${conversation.inbox.channelType} message to ${contactInbox.sourceId}`);
              break;
          }
        } catch (err) {
          this.logger.error(`Failed to send platform message: ${err}`);
        }
      }
    }

    return message;
  }
}
