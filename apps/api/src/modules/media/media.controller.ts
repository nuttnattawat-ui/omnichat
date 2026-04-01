import {
  Controller,
  Get,
  Param,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LineAdapter } from '../../adapters/line.adapter';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineAdapter: LineAdapter,
  ) {}

  /**
   * Proxy LINE message content (images, video, audio).
   * GET /api/media/line/:messageId
   * LINE message IDs are 18-digit random numbers - unguessable.
   */
  @Get('line/:messageId')
  async getLineContent(
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    try {
      // Find the message to get the inbox (and its LINE token)
      const message = await this.prisma.message.findFirst({
        where: { sourceId: messageId },
        include: { inbox: true },
      });

      if (!message) {
        this.logger.warn(`Media not found: sourceId=${messageId}`);
        return res.status(404).json({ message: 'Not found' });
      }

      const config = message.inbox.channelConfig as Record<string, string>;
      const lineToken = config.channelAccessToken;

      if (!lineToken) {
        this.logger.error(`No channelAccessToken for inbox ${message.inboxId}`);
        return res.status(500).json({ message: 'No access token' });
      }

      this.logger.log(`Proxying LINE content: messageId=${messageId}, inboxId=${message.inboxId}`);

      const { buffer, contentType } = await this.lineAdapter.getMessageContent(
        lineToken,
        messageId,
      );

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      });
      return res.send(buffer);
    } catch (err) {
      this.logger.error(`Failed to proxy LINE content ${messageId}: ${err}`);
      return res.status(502).json({ message: 'Failed to fetch content from LINE' });
    }
  }
}
