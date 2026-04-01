import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
    private readonly lineAdapter: LineAdapter,
    private readonly facebookAdapter: FacebookAdapter,
  ) {}

  @Get()
  findAll(
    @Req() req: { user: { accountId: number } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.findAll(
      req.user.accountId,
      parseInt(page || '1'),
      parseInt(limit || '50'),
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.contactsService.findOne(id, req.user.accountId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: { name?: string; email?: string; phone?: string },
  ) {
    return this.contactsService.update(id, req.user.accountId, body);
  }

  /** Re-fetch profile from platform API */
  @Post(':id/refresh')
  async refreshProfile(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { id, accountId: req.user.accountId },
        include: {
          contactInboxes: { include: { inbox: true } },
        },
      });

      if (!contact) return { error: 'Contact not found' };

      this.logger.log(`Refreshing profile for contact ${id}, inboxes: ${contact.contactInboxes.length}`);

      for (const ci of contact.contactInboxes) {
        const config = ci.inbox.channelConfig as Record<string, string>;
        this.logger.log(`Trying inbox ${ci.inbox.id} (${ci.inbox.channelType}), sourceId=${ci.sourceId}, hasToken=${!!(config.pageAccessToken || config.channelAccessToken)}`);
        try {
          if (ci.inbox.channelType === 'line') {
            const profile = await this.lineAdapter.getUserProfile(config.channelAccessToken, ci.sourceId);
            await this.prisma.contact.update({
              where: { id },
              data: { name: profile.displayName, avatarUrl: profile.pictureUrl },
            });
            this.logger.log(`Refreshed LINE profile for contact ${id}: ${profile.displayName}`);
            return { name: profile.displayName, avatarUrl: profile.pictureUrl };
          } else if (ci.inbox.channelType === 'facebook' || ci.inbox.channelType === 'instagram') {
            const profile = await this.facebookAdapter.getUserProfile(config.pageAccessToken, ci.sourceId);
            await this.prisma.contact.update({
              where: { id },
              data: { name: profile.name, avatarUrl: profile.profilePic },
            });
            this.logger.log(`Refreshed ${ci.inbox.channelType} profile for contact ${id}: ${profile.name}`);
            return { name: profile.name, avatarUrl: profile.profilePic };
          }
        } catch (err) {
          this.logger.error(`Failed to refresh profile for contact ${id}: ${err}`);
          return { error: `Failed to fetch profile: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      return { error: 'No channel inbox found' };
    } catch (err) {
      this.logger.error(`Refresh profile error for contact ${id}: ${err}`);
      return { error: `Server error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
