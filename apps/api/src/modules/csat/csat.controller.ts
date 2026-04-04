import { Controller, Post, Get, Param, Body, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('csat')
@UseGuards(JwtAuthGuard)
export class CsatController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':conversationId')
  async submit(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: { rating: number; feedback?: string },
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, accountId: req.user.accountId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const rating = await this.prisma.csatRating.upsert({
      where: { conversationId },
      create: {
        conversationId,
        accountId: req.user.accountId,
        contactId: conversation.contactId,
        assigneeId: conversation.assigneeId,
        rating: Math.min(5, Math.max(1, body.rating)),
        feedback: body.feedback,
      },
      update: {
        rating: Math.min(5, Math.max(1, body.rating)),
        feedback: body.feedback,
      },
    });

    return { id: rating.id };
  }

  @Get('stats')
  async stats(@Req() req: { user: { accountId: number } }) {
    const ratings = await this.prisma.csatRating.findMany({
      where: { accountId: req.user.accountId },
      select: { rating: true },
    });

    if (ratings.length === 0) {
      return { avg: 0, total: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } };
    }

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let sum = 0;
    for (const r of ratings) {
      sum += r.rating;
      distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;
    }

    return {
      avg: Math.round((sum / ratings.length) * 10) / 10,
      total: ratings.length,
      distribution,
    };
  }
}
