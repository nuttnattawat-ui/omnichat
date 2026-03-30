import { Injectable } from '@nestjs/common';
import { FacebookAdapter } from './facebook.adapter';
import { NormalizedMessage } from '../common/interfaces/normalized-message.interface';

@Injectable()
export class InstagramAdapter extends FacebookAdapter {
  /** Instagram uses the same Graph API as Facebook, same signature validation */

  override parseWebhook(
    body: Record<string, unknown>,
  ): NormalizedMessage[] {
    const messages: NormalizedMessage[] = [];
    const entries = (body.entry || []) as Record<string, unknown>[];

    for (const entry of entries) {
      const messagingEvents = (entry.messaging || []) as Record<
        string,
        unknown
      >[];

      for (const event of messagingEvents) {
        if (event.message) {
          messages.push(this.normalizeEvent(event, 'instagram'));
        }
      }
    }

    return messages;
  }
}
