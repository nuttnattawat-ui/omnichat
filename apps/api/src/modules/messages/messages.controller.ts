import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('page') page?: string,
  ) {
    return this.messagesService.findByConversation(
      conversationId,
      parseInt(page || '1'),
    );
  }

  @Post()
  create(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Req() req: { user: { userId: number; accountId: number } },
    @Body() body: { content: string; contentType?: string; private?: boolean; contentAttributes?: Record<string, unknown> },
  ) {
    return this.messagesService.createOutgoing(
      conversationId,
      req.user.userId,
      req.user.accountId,
      body,
    );
  }
}
