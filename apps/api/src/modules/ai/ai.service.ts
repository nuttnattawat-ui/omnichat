import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';
import { NormalizedMessage } from '../../common/interfaces/normalized-message.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /** Handle AI auto-reply for incoming messages */
  async handleAutoReply(
    conversationId: number,
    inbox: { id: number; accountId: number; aiPrompt: string | null },
    incomingMsg: NormalizedMessage,
  ) {
    if (!this.client) {
      this.logger.warn('Anthropic API key not configured');
      return;
    }

    try {
      // Get recent conversation history for context
      const recentMessages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const history = recentMessages.reverse().map((m) => ({
        role: m.messageType === 'incoming' ? 'user' : 'assistant',
        content: m.content || '',
      }));

      const systemPrompt =
        inbox.aiPrompt ||
        'You are a helpful customer support assistant. Be friendly, concise, and helpful. Respond in the same language as the customer.';

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const aiReply =
        response.content[0].type === 'text' ? response.content[0].text : '';

      if (!aiReply) return;

      // Save AI reply as outgoing message
      const savedReply = await this.prisma.message.create({
        data: {
          conversationId,
          accountId: inbox.accountId,
          inboxId: inbox.id,
          messageType: 'outgoing',
          content: aiReply,
          contentType: 'text',
          senderType: 'Bot',
        },
      });

      // Update conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastActivityAt: new Date(),
          waitingSince: null,
          messagesCount: { increment: 1 },
        },
      });

      // Broadcast via WebSocket
      this.chatGateway.broadcastMessage(conversationId, {
        ...savedReply,
        senderName: 'AI Assistant',
        channel: incomingMsg.channel,
      });

      this.logger.log(`AI reply sent for conversation ${conversationId}`);

      // Return the reply so the webhook can send it back to the platform
      return aiReply;
    } catch (error) {
      this.logger.error('AI auto-reply failed:', error);
    }
  }

  /** Generate a one-off AI response (for manual trigger) */
  async generateReply(
    conversationId: number,
    customPrompt?: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured');
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const history = messages.reverse().map((m) => ({
      role:
        m.messageType === 'incoming'
          ? ('user' as const)
          : ('assistant' as const),
      content: m.content || '',
    }));

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:
        customPrompt ||
        'You are a helpful customer support assistant. Suggest a reply for the agent. Be concise.',
      messages: history,
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }
}
