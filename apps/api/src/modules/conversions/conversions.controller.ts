import {
  Controller,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash } from 'crypto';

@Controller('conversions')
@UseGuards(JwtAuthGuard)
export class ConversionsController {
  private readonly logger = new Logger(ConversionsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post(':conversationId')
  async trackConversion(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: { amount?: number; currency?: string },
  ) {
    // 1. Find conversation with contact + inbox
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, accountId: req.user.accountId },
      include: {
        contact: true,
        inbox: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // 2. Find contactInbox to get the sourceId (Facebook PSID)
    const contactInbox = await this.prisma.contactInbox.findFirst({
      where: {
        contactId: conversation.contactId,
        inboxId: conversation.inboxId,
      },
    });

    if (!contactInbox) {
      throw new NotFoundException('Contact inbox not found');
    }

    const sourceId = contactInbox.sourceId;
    const amount = body.amount || 0;
    const currency = body.currency || 'THB';

    // 3. Send Purchase event to Facebook Conversions API
    const pixelId = process.env.META_PIXEL_ID;
    const capiToken = process.env.META_CAPI_TOKEN;

    let eventId: string | undefined;

    if (pixelId && capiToken) {
      const hashedContactId = createHash('sha256')
        .update(String(conversation.contactId))
        .digest('hex');

      const eventData = {
        data: [
          {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            action_source: 'website',
            user_data: {
              external_id: hashedContactId,
              fb_login_id: sourceId,
            },
            custom_data: {
              value: amount,
              currency,
              content_name: `Conversation #${conversationId}`,
            },
          },
        ],
      };

      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${capiToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          },
        );

        const result = await response.json();

        if (!response.ok) {
          this.logger.error('Facebook CAPI error', result);
          throw new BadRequestException(
            result?.error?.message || 'Failed to send event to Facebook',
          );
        }

        eventId = result?.events_received
          ? `fb_${Date.now()}`
          : undefined;

        this.logger.log(
          `Facebook CAPI Purchase event sent for conversation #${conversationId}`,
        );
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.error('Facebook CAPI request failed', error);
        throw new BadRequestException('Failed to connect to Facebook API');
      }
    } else {
      this.logger.warn(
        'META_PIXEL_ID or META_CAPI_TOKEN not configured, skipping Facebook CAPI',
      );
    }

    // 4. Store conversion status on conversation
    const existingAttrs =
      (conversation.customAttributes as Record<string, unknown>) || {};

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        customAttributes: {
          ...existingAttrs,
          conversionStatus: 'sold',
          conversionAmount: amount,
          conversionCurrency: currency,
          conversionAt: new Date().toISOString(),
        },
      },
    });

    return { success: true, eventId };
  }
}
