import { NormalizedMessage, OutgoingMessage } from './normalized-message.interface';

export interface ChannelAdapter {
  /** Validate incoming webhook signature */
  validateSignature(rawBody: Buffer, signature: string): boolean;

  /** Parse webhook payload into normalized messages */
  parseWebhook(body: unknown): NormalizedMessage[];

  /** Send a message back to the platform */
  sendMessage(
    channelConfig: Record<string, string>,
    recipientId: string,
    message: OutgoingMessage,
    replyToken?: string,
  ): Promise<void>;
}
