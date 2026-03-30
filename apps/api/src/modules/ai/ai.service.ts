import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../../gateway/chat.gateway';
import { NormalizedMessage } from '../../common/interfaces/normalized-message.interface';

type AiProvider = 'anthropic' | 'openrouter';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;
  private provider: AiProvider = 'anthropic';

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {
    this.initClient();
  }

  private initClient() {
    // Priority: OPENROUTER_API_KEY > ANTHROPIC_API_KEY
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (openrouterKey) {
      this.provider = 'openrouter';
      this.client = new Anthropic({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      this.logger.log('AI provider: OpenRouter');
    } else if (anthropicKey) {
      this.provider = 'anthropic';
      this.client = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('AI provider: Anthropic');
    }
  }

  private getModel(): string {
    // Custom model override via env
    if (process.env.AI_MODEL) return process.env.AI_MODEL;

    // Defaults per provider
    return this.provider === 'openrouter'
      ? 'anthropic/claude-sonnet-4-20250514'
      : 'claude-sonnet-4-20250514';
  }

  /** Call AI and get text response */
  private async chat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
    }

    const response = await this.client.messages.create({
      model: this.getModel(),
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }

  /** Build message history from conversation */
  private async getHistory(conversationId: number) {
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return recentMessages.reverse().map((m) => ({
      role: (m.messageType === 'incoming' ? 'user' : 'assistant') as
        | 'user'
        | 'assistant',
      content: m.content || '',
    }));
  }

  /** Handle AI auto-reply for incoming messages */
  async handleAutoReply(
    conversationId: number,
    inbox: { id: number; accountId: number; aiPrompt: string | null },
    incomingMsg: NormalizedMessage,
  ) {
    if (!this.client) {
      this.logger.warn('No AI provider configured');
      return;
    }

    try {
      const history = await this.getHistory(conversationId);

      const systemPrompt =
        inbox.aiPrompt ||
        'You are a helpful customer support assistant. Be friendly, concise, and helpful. Respond in the same language as the customer.';

      const aiReply = await this.chat(systemPrompt, history);
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

      this.logger.log(
        `AI reply sent (${this.provider}) for conversation ${conversationId}`,
      );

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
    const history = await this.getHistory(conversationId);

    return this.chat(
      customPrompt ||
        'You are a helpful customer support assistant. Suggest a reply for the agent. Be concise.',
      history,
    );
  }
}
