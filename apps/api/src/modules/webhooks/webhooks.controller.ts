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

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

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
  verifyFacebook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (
      mode === 'subscribe' &&
      token === process.env.META_VERIFY_TOKEN
    ) {
      this.logger.log('Facebook webhook verified');
      return res.status(200).send(challenge);
    }
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
  verifyInstagram(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (
      mode === 'subscribe' &&
      token === process.env.META_VERIFY_TOKEN
    ) {
      this.logger.log('Instagram webhook verified');
      return res.status(200).send(challenge);
    }
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
