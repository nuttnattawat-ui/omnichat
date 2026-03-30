import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  findAll(
    @Req() req: { user: { accountId: number } },
    @Query('status') status?: string,
    @Query('inboxId') inboxId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('page') page?: string,
  ) {
    return this.conversationsService.findAll(
      req.user.accountId,
      {
        status,
        inboxId: inboxId ? parseInt(inboxId) : undefined,
        assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
      },
      parseInt(page || '1'),
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.conversationsService.findOne(id, req.user.accountId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body('status') status: string,
  ) {
    return this.conversationsService.updateStatus(
      id,
      req.user.accountId,
      status,
    );
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body('assigneeId') assigneeId: number | null,
  ) {
    return this.conversationsService.assign(
      id,
      req.user.accountId,
      assigneeId,
    );
  }
}
