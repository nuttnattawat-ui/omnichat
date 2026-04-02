import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NormalizedMessage } from '../common/interfaces/normalized-message.interface';
import { ChatGateway } from '../gateway/chat.gateway';
import { AiService } from '../modules/ai/ai.service';
import { MessagesService } from '../modules/messages/messages.service';
import { LineAdapter } from '../adapters/line.adapter';
import { FacebookAdapter } from '../adapters/facebook.adapter';

@Injectable()
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly aiService: AiService,
    private readonly messagesService: MessagesService,
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
  ) {}

  async handleIncomingMessage(job: { data: NormalizedMessage }) {
    const msg = job.data;
    this.logger.log(
      `Processing ${msg.channel} message: ${msg.platformMessageId}`,
    );

    // 1. Find inbox — match by Page ID (recipientId) if available, else by channel
    let inbox = null;
    if (msg.recipientId && (msg.channel === 'facebook' || msg.channel === 'instagram')) {
      // Match Facebook/Instagram inbox by Page ID stored in channelConfig.pageId
      const allInboxes = await this.prisma.inbox.findMany({
        where: { channelType: msg.channel, enabled: true },
      });
      inbox = allInboxes.find((i) => {
        const config = i.channelConfig as Record<string, string>;
        return config.pageId === msg.recipientId;
      }) || allInboxes[0]; // fallback to first if pageId not configured
      if (inbox) {
        this.logger.log(`Matched inbox ${inbox.id} by pageId=${msg.recipientId}`);
      }
    }
    if (!inbox) {
      inbox = await this.prisma.inbox.findFirst({
        where: { channelType: msg.channel, enabled: true },
      });
    }

    if (!inbox) {
      this.logger.warn(`No active inbox for channel: ${msg.channel}`);
      return;
    }

    // Auto-save Page ID into inbox config if not set yet (for correct inbox matching)
    if (msg.recipientId && (msg.channel === 'facebook' || msg.channel === 'instagram')) {
      const config = inbox.channelConfig as Record<string, string>;
      if (!config.pageId) {
        this.logger.log(`Auto-saving pageId=${msg.recipientId} to inbox ${inbox.id}`);
        await this.prisma.inbox.update({
          where: { id: inbox.id },
          data: { channelConfig: { ...config, pageId: msg.recipientId } },
        });
      }
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

      // Fetch real profile from platform API when creating a new contact
      if (msg.channel === 'line') {
        try {
          const channelConfig = inbox.channelConfig as Record<string, string>;
          const token = channelConfig.channelAccessToken;
          this.logger.log(
            `Fetching LINE profile for ${msg.sender.platformId}, token exists: ${!!token}, token length: ${token?.length || 0}, config keys: ${Object.keys(channelConfig).join(',')}`,
          );
          const profile = await this.lineAdapter.getUserProfile(
            token,
            msg.sender.platformId,
          );
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
          this.logger.log(`Got LINE profile: ${profile.displayName}, avatar: ${!!profile.pictureUrl}`);
        } catch (err) {
          this.logger.error(
            `FAILED to fetch LINE profile for ${msg.sender.platformId}: ${err}`,
          );
        }
      } else if (msg.channel === 'facebook' || msg.channel === 'instagram') {
        const channelConfig = inbox.channelConfig as Record<string, string>;
        const token = channelConfig.pageAccessToken;
        this.logger.log(`Fetching ${msg.channel} profile for ${msg.sender.platformId}, tokenLength=${token?.length || 0}`);

        // Try twice with a short delay between attempts
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const profile = await this.facebookAdapter.getUserProfile(token, msg.sender.platformId);
            displayName = profile.name;
            avatarUrl = profile.profilePic;
            this.logger.log(`Got ${msg.channel} profile (attempt ${attempt + 1}): ${profile.name}, pic: ${!!profile.profilePic}`);
            break;
          } catch (err) {
            this.logger.error(`FAILED to fetch ${msg.channel} profile for ${msg.sender.platformId} (attempt ${attempt + 1}): ${err}`);
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
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

    // 3.5 Update contact profile from platform API (always try if name/avatar missing or stale)
    if (contactInbox.contact) {
      const contact = contactInbox.contact;
      const nameLower = contact.name?.toLowerCase() || '';
      const needsUpdate = !contact.avatarUrl || !contact.name || nameLower === `${msg.channel} user` || nameLower.endsWith(' user') || nameLower === 'unknown';
      this.logger.log(`Contact ${contact.id}: name="${contact.name}", avatarUrl=${!!contact.avatarUrl}, needsUpdate=${needsUpdate}`);
      if (needsUpdate) {
        try {
          const channelConfig = inbox.channelConfig as Record<string, string>;
          if (msg.channel === 'line') {
            const token = channelConfig.channelAccessToken;
            const profile = await this.lineAdapter.getUserProfile(token, msg.sender.platformId);
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { name: profile.displayName, avatarUrl: profile.pictureUrl },
            });
            contactInbox.contact.name = profile.displayName;
            contactInbox.contact.avatarUrl = profile.pictureUrl ?? null;
            this.logger.log(`Updated LINE profile for contact ${contact.id}: ${profile.displayName}`);
          } else if (msg.channel === 'facebook' || msg.channel === 'instagram') {
            const token = channelConfig.pageAccessToken;
            const profile = await this.facebookAdapter.getUserProfile(token, msg.sender.platformId);
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { name: profile.name, avatarUrl: profile.profilePic },
            });
            contactInbox.contact.name = profile.name;
            contactInbox.contact.avatarUrl = profile.profilePic ?? null;
            this.logger.log(`Updated ${msg.channel} profile for contact ${contact.id}: ${profile.name}`);
          }
        } catch (err) {
          this.logger.error(`FAILED to update profile for contact ${contact.id}: ${err}`);
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

    // 5. Resolve content for non-text messages
    let messageContent = msg.content;
    this.logger.log(
      `Message type=${msg.contentType}, content="${messageContent?.substring(0, 50) || '(empty)'}", attrs=${JSON.stringify(msg.contentAttributes ?? {}).substring(0, 200)}`,
    );

    // Download LINE image content immediately and store as data URL
    if (
      msg.channel === 'line' &&
      msg.contentType === 'image' &&
      !messageContent
    ) {
      try {
        const channelConfig = inbox.channelConfig as Record<string, string>;
        const token = channelConfig.channelAccessToken;
        this.logger.log(`Downloading LINE image: messageId=${msg.platformMessageId}`);
        const { buffer, contentType } = await this.lineAdapter.getMessageContent(
          token,
          msg.platformMessageId,
        );
        messageContent = `data:${contentType};base64,${buffer.toString('base64')}`;
        this.logger.log(`LINE image downloaded: ${buffer.length} bytes, type=${contentType}`);
      } catch (err) {
        this.logger.error(`Failed to download LINE image: ${err}`);
        messageContent = `/api/media/line/${msg.platformMessageId}`;
      }
    } else if (
      msg.channel === 'line' &&
      msg.contentType === 'sticker' &&
      !messageContent &&
      msg.contentAttributes?.stickerId
    ) {
      // For stickers, store CDN URL as content (Content API doesn't support stickers)
      const sid = msg.contentAttributes.stickerId;
      messageContent = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${sid}/android/sticker.png`;
      this.logger.log(`LINE sticker CDN URL: stickerId=${sid}`);
    } else if (
      msg.channel === 'line' &&
      ['video', 'audio'].includes(msg.contentType) &&
      !messageContent
    ) {
      messageContent = `/api/media/line/${msg.platformMessageId}`;
    }

    // 5. Save message
    const savedMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        accountId: inbox.accountId,
        inboxId: inbox.id,
        messageType: 'incoming',
        content: messageContent,
        contentType: msg.contentType,
        contentAttributes: JSON.parse(JSON.stringify({
          ...(msg.contentAttributes ?? {}),
          originalPayload: undefined,
          rawPayload: undefined,
        })),
        sourceId: msg.platformMessageId,
        // senderId FK points to User table, so leave null for Contact messages
        // Contact identity is tracked via conversation.contactId
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

    // 7.5 Broadcast conversation update (for sidebar: name, avatar, last message)
    this.chatGateway.broadcastConversationUpdate(inbox.accountId, {
      id: conversation.id,
      contactId: contactInbox.contactId,
      contact: {
        id: contactInbox.contact.id,
        name: contactInbox.contact.name,
        avatarUrl: contactInbox.contact.avatarUrl,
      },
      lastMessage: {
        content: msg.content,
        contentType: msg.contentType,
        createdAt: savedMessage.createdAt,
      },
      lastActivityAt: new Date(),
      messagesCount: (conversation.messagesCount ?? 0) + 1,
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
