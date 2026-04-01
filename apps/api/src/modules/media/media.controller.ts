import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LineAdapter } from '../../adapters/line.adapter';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineAdapter: LineAdapter,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Proxy LINE message content (images, video, audio).
   * GET /api/media/line/:messageId?token=jwt
   * Supports token via query param (for <img> tags) or Authorization header.
   */
  @Get('line/:messageId')
  async getLineContent(
    @Param('messageId') messageId: string,
    @Query('token') queryToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Verify JWT from query param or header
    const token = queryToken || (req.headers.authorization?.replace('Bearer ', '') ?? '');
    try {
      this.jwtService.verify(token);
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      // Find the message to get the inbox (and its token)
      const message = await this.prisma.message.findFirst({
        where: { sourceId: messageId },
        include: { inbox: true },
      });

      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }

      const config = message.inbox.channelConfig as Record<string, string>;
      const token = config.channelAccessToken;

      if (!token) {
        return res.status(500).json({ message: 'No access token configured' });
      }

      const { buffer, contentType } = await this.lineAdapter.getMessageContent(
        token,
        messageId,
      );

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache 24h
      });
      return res.send(buffer);
    } catch (err) {
      this.logger.error(`Failed to proxy LINE content ${messageId}: ${err}`);
      return res.status(502).json({ message: 'Failed to fetch content' });
    }
  }
}
