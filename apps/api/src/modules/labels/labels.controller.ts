import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() req: { user: { accountId: number } }) {
    return this.prisma.label.findMany({
      where: { accountId: req.user.accountId },
      orderBy: { title: 'asc' },
    });
  }

  @Post()
  create(
    @Req() req: { user: { accountId: number } },
    @Body() body: { title: string; color?: string },
  ) {
    return this.prisma.label.create({
      data: {
        accountId: req.user.accountId,
        title: body.title,
        color: body.color || '#6366f1',
      },
    });
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    await this.prisma.label.deleteMany({
      where: { id, accountId: req.user.accountId },
    });
    return { success: true };
  }

  /** Add label to conversation */
  @Post('conversations/:conversationId/:labelId')
  addToConversation(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ) {
    return this.prisma.conversationLabel.create({
      data: { conversationId, labelId },
    });
  }

  /** Remove label from conversation */
  @Delete('conversations/:conversationId/:labelId')
  async removeFromConversation(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ) {
    await this.prisma.conversationLabel.deleteMany({
      where: { conversationId, labelId },
    });
    return { success: true };
  }

  /** Get labels for a conversation */
  @Get('conversations/:conversationId')
  getConversationLabels(
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    return this.prisma.conversationLabel.findMany({
      where: { conversationId },
      include: { label: true },
    });
  }
}
