import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ChannelAdapter } from '../common/interfaces/channel-adapter.interface';
import {
  NormalizedMessage,
  OutgoingMessage,
} from '../common/interfaces/normalized-message.interface';

@Injectable()
export class LineAdapter implements ChannelAdapter {
  validateSignature(rawBody: Buffer, signature: string): boolean {
    const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
    const hash = createHmac('sha256', channelSecret)
      .update(rawBody)
      .digest('base64');
    return hash === signature;
  }

  parseWebhook(body: Record<string, unknown>): NormalizedMessage[] {
    const events = (body.events || []) as Record<string, unknown>[];
    return events
      .filter((event) => event.type === 'message')
      .map((event) => this.normalizeEvent(event));
  }

  private normalizeEvent(event: Record<string, unknown>): NormalizedMessage {
    const source = event.source as Record<string, string>;
    const message = event.message as Record<string, unknown>;
    const messageType = message.type as string;

    return {
      platformMessageId: message.id as string,
      channel: 'line',
      sender: {
        platformId: source.userId,
        displayName: undefined, // Fetched separately via LINE Profile API
        avatarUrl: undefined,
      },
      content: (message.text as string) || '',
      contentType: this.mapContentType(messageType),
      contentAttributes: {
        lineMessageType: messageType,
        ...(message.stickerId ? { stickerId: String(message.stickerId) } : {}),
        ...(message.packageId ? { packageId: String(message.packageId) } : {}),
      },
      timestamp: new Date(event.timestamp as number),
      replyToken: event.replyToken as string,
      rawPayload: event,
    };
  }

  private mapContentType(
    lineType: string,
  ): NormalizedMessage['contentType'] {
    const map: Record<string, NormalizedMessage['contentType']> = {
      text: 'text',
      image: 'image',
      video: 'video',
      audio: 'audio',
      file: 'file',
      sticker: 'sticker',
      location: 'location',
    };
    return map[lineType] || 'text';
  }

  async sendMessage(
    channelConfig: Record<string, string>,
    recipientId: string,
    message: OutgoingMessage,
    replyToken?: string,
  ): Promise<void> {
    const token = channelConfig.channelAccessToken;
    const lineMessage = this.buildLineMessage(message);

    // Use reply if we have a replyToken (free), otherwise push (costs money)
    if (replyToken) {
      await this.callLineApi(
        'https://api.line.me/v2/bot/message/reply',
        token,
        { replyToken, messages: [lineMessage] },
      );
    } else {
      await this.callLineApi(
        'https://api.line.me/v2/bot/message/push',
        token,
        { to: recipientId, messages: [lineMessage] },
      );
    }
  }

  private buildLineMessage(message: OutgoingMessage): Record<string, unknown> {
    switch (message.contentType) {
      case 'image':
        return {
          type: 'image',
          originalContentUrl: message.content,
          previewImageUrl: message.content,
        };
      case 'video':
        return {
          type: 'video',
          originalContentUrl: message.content,
          previewImageUrl:
            (message.contentAttributes?.thumbnailUrl as string) || '',
        };
      default:
        return { type: 'text', text: message.content };
    }
  }

  private async callLineApi(
    url: string,
    token: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API error: ${response.status} ${error}`);
    }
  }

  /** Fetch user profile from LINE */
  async getUserProfile(
    token: string,
    userId: string,
  ): Promise<{ displayName: string; pictureUrl?: string }> {
    const response = await fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch LINE profile: ${response.status}`);
    }

    return response.json() as Promise<{
      displayName: string;
      pictureUrl?: string;
    }>;
  }
}
