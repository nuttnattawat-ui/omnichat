import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InboxesService } from './inboxes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('inboxes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InboxesController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get()
  findAll(@Req() req: { user: { accountId: number } }) {
    return this.inboxesService.findAll(req.user.accountId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.inboxesService.findOne(id, req.user.accountId);
  }

  @Post()
  @Roles('admin')
  create(
    @Req() req: { user: { accountId: number } },
    @Body()
    body: {
      name: string;
      channelType: string;
      channelConfig: Record<string, string>;
      greeting?: string;
      aiEnabled?: boolean;
      aiPrompt?: string;
    },
  ) {
    return this.inboxesService.create(req.user.accountId, body);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: Record<string, unknown>,
  ) {
    return this.inboxesService.update(id, req.user.accountId, body);
  }

  @Delete(':id')
  @Roles('admin')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.inboxesService.delete(id, req.user.accountId);
  }
}
