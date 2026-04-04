import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(
    @Req() req: { user: { accountId: number } },
    @Query('q') query: string,
  ) {
    if (!query?.trim() || query.trim().length < 2) {
      return { conversations: [], contacts: [], messages: [] };
    }

    const q = query.trim();
    const accountId = req.user.accountId;

    const [contacts, messages, conversations] = await Promise.all([
      // Search contacts by name, email, phone
      this.prisma.contact.findMany({
        where: {
          accountId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        },
        select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        take: 20,
      }),

      // Search messages by content
      this.prisma.message.findMany({
        where: {
          accountId,
          content: { contains: q, mode: 'insensitive' },
          contentType: 'text',
        },
        select: {
          id: true,
          conversationId: true,
          content: true,
          messageType: true,
          createdAt: true,
          conversation: {
            select: {
              contact: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),

      // Search conversations by contact name
      this.prisma.conversation.findMany({
        where: {
          accountId,
          contact: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
        include: {
          contact: { select: { id: true, name: true, avatarUrl: true } },
          inbox: { select: { id: true, name: true, channelType: true } },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 20,
      }),
    ]);

    return { contacts, messages, conversations };
  }
}
