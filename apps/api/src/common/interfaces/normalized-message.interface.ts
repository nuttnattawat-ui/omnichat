export interface NormalizedMessage {
  platformMessageId: string;
  channel: 'line' | 'facebook' | 'instagram';
  sender: {
    platformId: string;
    displayName?: string;
    avatarUrl?: string;
  };
  content: string;
  contentType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location';
  contentAttributes?: Record<string, unknown>;
  timestamp: Date;
  replyToken?: string; // LINE-specific
  rawPayload: Record<string, unknown>;
}

export interface OutgoingMessage {
  conversationId: number;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'sticker';
  contentAttributes?: Record<string, unknown>;
}
