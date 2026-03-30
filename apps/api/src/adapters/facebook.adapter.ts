import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ChannelAdapter } from '../common/interfaces/channel-adapter.interface';
import {
  NormalizedMessage,
  OutgoingMessage,
} from '../common/interfaces/normalized-message.interface';

@Injectable()
export class FacebookAdapter implements ChannelAdapter {
  validateSignature(rawBody: Buffer, signature: string): boolean {
    const appSecret = process.env.META_APP_SECRET || '';
    const expectedSig =
      'sha256=' +
      createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return expectedSig === signature;
  }

  parseWebhook(body: Record<string, unknown>): NormalizedMessage[] {
    const messages: NormalizedMessage[] = [];
    const entries = (body.entry || []) as Record<string, unknown>[];

    for (const entry of entries) {
      const messagingEvents = (entry.messaging || []) as Record<
        string,
        unknown
      >[];

      for (const event of messagingEvents) {
        if (event.message) {
          messages.push(this.normalizeEvent(event, 'facebook'));
        }
      }
    }

    return messages;
  }

  protected normalizeEvent(
    event: Record<string, unknown>,
    channel: 'facebook' | 'instagram',
  ): NormalizedMessage {
    const sender = event.sender as Record<string, string>;
    const message = event.message as Record<string, unknown>;
    const attachments = message.attachments as
      | Record<string, unknown>[]
      | undefined;

    let content = (message.text as string) || '';
    let contentType: NormalizedMessage['contentType'] = 'text';

    if (attachments?.length) {
      const attachment = attachments[0];
      const payload = attachment.payload as Record<string, string>;
      contentType = this.mapAttachmentType(attachment.type as string);
      content = payload?.url || content;
    }

    return {
      platformMessageId: message.mid as string,
      channel,
      sender: {
        platformId: sender.id,
      },
      content,
      contentType,
      contentAttributes: {
        attachments,
        originalPayload: event,
      },
      timestamp: new Date((event.timestamp as number) || Date.now()),
      rawPayload: event,
    };
  }

  private mapAttachmentType(
    type: string,
  ): NormalizedMessage['contentType'] {
    const map: Record<string, NormalizedMessage['contentType']> = {
      image: 'image',
      video: 'video',
      audio: 'audio',
      file: 'file',
    };
    return map[type] || 'text';
  }

  async sendMessage(
    channelConfig: Record<string, string>,
    recipientId: string,
    message: OutgoingMessage,
  ): Promise<void> {
    const token = channelConfig.pageAccessToken;
    const fbMessage = this.buildFbMessage(message);

    const response = await fetch(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: fbMessage,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${response.status} ${error}`);
    }
  }

  private buildFbMessage(
    message: OutgoingMessage,
  ): Record<string, unknown> {
    switch (message.contentType) {
      case 'image':
      case 'video':
      case 'file':
        return {
          attachment: {
            type: message.contentType,
            payload: { url: message.content, is_reusable: true },
          },
        };
      default:
        return { text: message.content };
    }
  }
}
