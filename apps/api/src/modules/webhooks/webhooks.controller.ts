import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Query,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly prisma: PrismaService,
  ) {}

  // =============================
  // LINE Webhook
  // =============================
  @Post('line')
  @HttpCode(200)
  async handleLine(@Req() req: Request) {
    const signature = req.headers['x-line-signature'] as string;
    this.logger.log('LINE webhook received');
    await this.webhooksService.handleLineWebhook(req.body, signature);
    return { status: 'ok' };
  }

  // =============================
  // Facebook Webhook
  // =============================
  @Get('facebook')
  async verifyFacebook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Facebook verify: mode=${mode}, token=${token?.substring(0, 6)}...`);

    if (mode !== 'subscribe') {
      return res.sendStatus(403);
    }

    // Check global env var first
    if (token === process.env.META_VERIFY_TOKEN) {
      this.logger.log('Facebook webhook verified (global token)');
      return res.status(200).send(challenge);
    }

    // Check per-inbox verifyToken
    const inboxes = await this.prisma.inbox.findMany({
      where: { channelType: 'facebook', enabled: true },
    });
    const matched = inboxes.some((inbox) => {
      const config = inbox.channelConfig as Record<string, string>;
      return config.verifyToken === token;
    });

    if (matched) {
      this.logger.log('Facebook webhook verified (inbox token)');
      return res.status(200).send(challenge);
    }

    this.logger.warn('Facebook webhook verification FAILED — token mismatch');
    return res.sendStatus(403);
  }

  @Post('facebook')
  @HttpCode(200)
  async handleFacebook(@Req() req: Request) {
    const signature = req.headers['x-hub-signature-256'] as string;
    this.logger.log('Facebook webhook received');
    await this.webhooksService.handleFacebookWebhook(req.body, signature);
    return { status: 'ok' };
  }

  // =============================
  // Instagram Webhook (same verification as FB)
  // =============================
  @Get('instagram')
  async verifyInstagram(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Instagram verify: mode=${mode}, token=${token?.substring(0, 6)}...`);

    if (mode !== 'subscribe') {
      return res.sendStatus(403);
    }

    if (token === process.env.META_VERIFY_TOKEN) {
      this.logger.log('Instagram webhook verified (global token)');
      return res.status(200).send(challenge);
    }

    const inboxes = await this.prisma.inbox.findMany({
      where: { channelType: 'instagram', enabled: true },
    });
    const matched = inboxes.some((inbox) => {
      const config = inbox.channelConfig as Record<string, string>;
      return config.verifyToken === token;
    });

    if (matched) {
      this.logger.log('Instagram webhook verified (inbox token)');
      return res.status(200).send(challenge);
    }

    this.logger.warn('Instagram webhook verification FAILED — token mismatch');
    return res.sendStatus(403);
  }

  @Post('instagram')
  @HttpCode(200)
  async handleInstagram(@Req() req: Request) {
    const signature = req.headers['x-hub-signature-256'] as string;
    this.logger.log('Instagram webhook received');
    await this.webhooksService.handleInstagramWebhook(req.body, signature);
    return { status: 'ok' };
  }
}
