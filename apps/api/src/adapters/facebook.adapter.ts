import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ChannelAdapter } from '../common/interfaces/channel-adapter.interface';
import {
  NormalizedMessage,
  OutgoingMessage,
} from '../common/interfaces/normalized-message.interface';

@Injectable()
export class FacebookAdapter implements ChannelAdapter {
  private readonly logger = new Logger(FacebookAdapter.name);
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

  /** Parse read receipt events from webhook payload */
  parseReadReceipts(body: Record<string, unknown>): { senderId: string; watermark: number }[] {
    const reads: { senderId: string; watermark: number }[] = [];
    const entries = (body.entry || []) as Record<string, unknown>[];

    for (const entry of entries) {
      const messagingEvents = (entry.messaging || []) as Record<string, unknown>[];
      for (const event of messagingEvents) {
        if (event.read) {
          const sender = event.sender as Record<string, string>;
          const read = event.read as { watermark: number };
          reads.push({ senderId: sender.id, watermark: read.watermark });
        }
      }
    }

    return reads;
  }

  protected normalizeEvent(
    event: Record<string, unknown>,
    channel: 'facebook' | 'instagram',
  ): NormalizedMessage {
    const sender = event.sender as Record<string, string>;
    const recipient = event.recipient as Record<string, string>;
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
      recipientId: recipient?.id, // Page ID — used to match the correct inbox
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

  async getUserProfile(
    pageAccessToken: string,
    userId: string,
  ): Promise<{ name: string; profilePic?: string }> {
    this.logger.log(`Fetching FB profile for ${userId}, token length=${pageAccessToken?.length || 0}`);

    // Try multiple API versions — some users only work on specific versions
    const versions = ['v21.0', 'v19.0', 'v17.0'];
    for (const version of versions) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/${version}/${userId}?fields=first_name,last_name,name,profile_pic&access_token=${pageAccessToken}`,
        );

        if (!response.ok) {
          const error = await response.text();
          this.logger.warn(`FB Profile API ${version} ${response.status}: ${error.substring(0, 200)}`);
          continue; // try next version
        }

        const data = await response.json() as Record<string, unknown>;
        this.logger.log(`FB profile ${version} response for ${userId}: ${JSON.stringify(data)}`);

        const firstName = data.first_name as string | undefined;
        const lastName = data.last_name as string | undefined;
        const name = data.name as string | undefined;
        const profilePic = data.profile_pic as string | undefined;

        const displayName = [firstName, lastName].filter(Boolean).join(' ') || name || '';
        if (displayName) {
          return { name: displayName, profilePic };
        }
      } catch (err) {
        this.logger.warn(`FB Profile API ${version} error: ${err}`);
      }
    }

    // Fallback: try Conversations API to get participant name
    try {
      this.logger.log(`Trying Conversations API fallback for ${userId}`);
      const convResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/conversations?user_id=${userId}&fields=participants&access_token=${pageAccessToken}`,
      );
      if (convResponse.ok) {
        const convData = await convResponse.json() as Record<string, unknown>;
        this.logger.log(`Conversations API response: ${JSON.stringify(convData).substring(0, 500)}`);
        const dataArr = convData.data as Record<string, unknown>[] | undefined;
        if (dataArr?.length) {
          const participants = (dataArr[0].participants as Record<string, unknown>)?.data as Record<string, unknown>[] | undefined;
          const user = participants?.find((p) => String(p.id) === userId);
          if (user?.name) {
            this.logger.log(`Got name from Conversations API: ${user.name}`);
            // Download profile picture and convert to base64 data URL
            let profilePic: string | undefined;
            try {
              const picRes = await fetch(
                `https://graph.facebook.com/${userId}/picture?type=large&access_token=${pageAccessToken}`,
                { redirect: 'follow' },
              );
              if (picRes.ok) {
                const buffer = Buffer.from(await picRes.arrayBuffer());
                const contentType = picRes.headers.get('content-type') || 'image/jpeg';
                profilePic = `data:${contentType};base64,${buffer.toString('base64')}`;
                this.logger.log(`Downloaded FB profile pic: ${buffer.length} bytes`);
              }
            } catch (picErr) {
              this.logger.warn(`FB picture download error: ${picErr}`);
            }
            return { name: String(user.name), profilePic };
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Conversations API fallback error: ${err}`);
    }

    throw new Error(`Could not fetch profile for ${userId} from any API version`);
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
