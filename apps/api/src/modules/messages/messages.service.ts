import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
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

    // TODO: Send to platform via adapter (LINE reply/push, FB Graph API)

    return message;
  }
}
