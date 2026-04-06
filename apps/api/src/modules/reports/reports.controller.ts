import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async getOverview(@Req() req: { user: { accountId: number } }) {
    const accountId = req.user.accountId;

    const [
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      totalContacts,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { accountId } }),
      this.prisma.conversation.count({ where: { accountId, status: 'open' } }),
      this.prisma.conversation.count({ where: { accountId, status: 'resolved' } }),
      this.prisma.message.count({ where: { accountId } }),
      this.prisma.contact.count({ where: { accountId } }),
    ]);

    // Avg messages per conversation
    const avgMessages = totalConversations > 0
      ? Math.round(totalMessages / totalConversations)
      : 0;

    // Resolution rate
    const resolutionRate = totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0;

    return {
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      totalContacts,
      avgMessages,
      resolutionRate,
    };
  }

  @Get('conversations-by-day')
  async getConversationsByDay(
    @Req() req: { user: { accountId: number } },
    @Query('days') daysStr?: string,
  ) {
    const accountId = req.user.accountId;
    const days = parseInt(daysStr || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        accountId,
        createdAt: { gte: since },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDay: Record<string, { total: number; resolved: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      byDay[key] = { total: 0, resolved: 0 };
    }

    for (const conv of conversations) {
      const key = conv.createdAt.toISOString().split('T')[0];
      if (byDay[key]) {
        byDay[key].total++;
        if (conv.status === 'resolved') byDay[key].resolved++;
      }
    }

    return Object.entries(byDay).map(([date, data]) => ({
      date,
      total: data.total,
      resolved: data.resolved,
    }));
  }

  @Get('messages-by-day')
  async getMessagesByDay(
    @Req() req: { user: { accountId: number } },
    @Query('days') daysStr?: string,
  ) {
    const accountId = req.user.accountId;
    const days = parseInt(daysStr || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);

    const messages = await this.prisma.message.findMany({
      where: {
        accountId,
        createdAt: { gte: since },
      },
      select: { createdAt: true, messageType: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, { incoming: number; outgoing: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      byDay[key] = { incoming: 0, outgoing: 0 };
    }

    for (const msg of messages) {
      const key = msg.createdAt.toISOString().split('T')[0];
      if (byDay[key]) {
        if (msg.messageType === 'incoming') byDay[key].incoming++;
        else if (msg.messageType === 'outgoing') byDay[key].outgoing++;
      }
    }

    return Object.entries(byDay).map(([date, data]) => ({
      date,
      incoming: data.incoming,
      outgoing: data.outgoing,
    }));
  }

  @Get('by-channel')
  async getByChannel(@Req() req: { user: { accountId: number } }) {
    const accountId = req.user.accountId;

    const inboxes = await this.prisma.inbox.findMany({
      where: { accountId },
      select: { id: true, name: true, channelType: true },
    });

    const result = await Promise.all(
      inboxes.map(async (inbox) => {
        const [conversations, messages] = await Promise.all([
          this.prisma.conversation.count({ where: { accountId, inboxId: inbox.id } }),
          this.prisma.message.count({ where: { accountId, inboxId: inbox.id } }),
        ]);
        return {
          inboxId: inbox.id,
          name: inbox.name,
          channelType: inbox.channelType,
          conversations,
          messages,
        };
      }),
    );

    return result;
  }

  @Get('agent-performance')
  async getAgentPerformance(@Req() req: { user: { accountId: number } }) {
    const accountId = req.user.accountId;

    const agents = await this.prisma.user.findMany({
      where: { accountId, isActive: true },
      select: { id: true, name: true, role: true, avatarUrl: true },
    });

    const result = await Promise.all(
      agents.map(async (agent) => {
        const [assigned, resolved, messagesSent] = await Promise.all([
          this.prisma.conversation.count({ where: { accountId, assigneeId: agent.id } }),
          this.prisma.conversation.count({ where: { accountId, assigneeId: agent.id, status: 'resolved' } }),
          this.prisma.message.count({ where: { accountId, senderId: agent.id, messageType: 'outgoing' } }),
        ]);
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          avatarUrl: agent.avatarUrl,
          assigned,
          resolved,
          messagesSent,
        };
      }),
    );

    return result;
  }

  @Get('agent-response-times')
  async getAgentResponseTimes(@Req() req: { user: { accountId: number } }) {
    const accountId = req.user.accountId;

    const agents = await this.prisma.user.findMany({
      where: { accountId, isActive: true },
      select: { id: true, name: true, role: true, avatarUrl: true },
    });

    // Get all conversations that have a first reply
    const conversations = await this.prisma.conversation.findMany({
      where: {
        accountId,
        firstReplyAt: { not: null },
      },
      select: {
        id: true,
        assigneeId: true,
        createdAt: true,
        firstReplyAt: true,
        inbox: { select: { slaMinutes: true } },
      },
    });

    // Calculate per-agent response time stats
    const result = agents.map((agent) => {
      const agentConvs = conversations.filter((c) => c.assigneeId === agent.id);
      const times = agentConvs
        .map((c) => {
          const diffMs = new Date(c.firstReplyAt!).getTime() - new Date(c.createdAt).getTime();
          return {
            minutes: Math.round(diffMs / 60000 * 10) / 10,
            sla: c.inbox.slaMinutes || 3,
          };
        })
        .filter((t) => t.minutes >= 0);

      if (times.length === 0) {
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          avatarUrl: agent.avatarUrl,
          totalConversations: 0,
          avgResponseMin: 0,
          medianResponseMin: 0,
          minResponseMin: 0,
          maxResponseMin: 0,
          breachedCount: 0,
          breachedRate: 0,
        };
      }

      const sorted = times.map((t) => t.minutes).sort((a, b) => a - b);
      const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length * 10) / 10;
      const median = sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 * 10) / 10
        : sorted[Math.floor(sorted.length / 2)];
      const breached = times.filter((t) => t.minutes > t.sla).length;

      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        avatarUrl: agent.avatarUrl,
        totalConversations: times.length,
        avgResponseMin: avg,
        medianResponseMin: median,
        minResponseMin: sorted[0],
        maxResponseMin: sorted[sorted.length - 1],
        breachedCount: breached,
        breachedRate: Math.round((breached / times.length) * 100),
      };
    });

    return result;
  }

  @Get('export/conversations')
  async exportConversations(
    @Req() req: { user: { accountId: number } },
    @Res() res: Response,
  ) {
    const accountId = req.user.accountId;
    const conversations = await this.prisma.conversation.findMany({
      where: { accountId },
      include: {
        contact: { select: { name: true, email: true, phone: true } },
        inbox: { select: { name: true, channelType: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    const header = 'ID,Contact,Email,Phone,Channel,Inbox,Status,Assignee,Messages,Created,Last Activity\n';
    const rows = conversations.map((c) =>
      [
        c.id,
        `"${(c.contact.name || '').replace(/"/g, '""')}"`,
        c.contact.email || '',
        c.contact.phone || '',
        c.inbox.channelType,
        `"${c.inbox.name.replace(/"/g, '""')}"`,
        c.status,
        c.assignee?.name || '',
        c.messagesCount,
        c.createdAt.toISOString(),
        c.lastActivityAt.toISOString(),
      ].join(','),
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=conversations.csv');
    res.send(header + rows);
  }

  @Get('export/messages')
  async exportMessages(
    @Req() req: { user: { accountId: number } },
    @Res() res: Response,
  ) {
    const accountId = req.user.accountId;
    const messages = await this.prisma.message.findMany({
      where: { accountId, contentType: 'text' },
      include: {
        conversation: {
          select: { contact: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'ID,Conversation ID,Contact,Type,Content,Created\n';
    const rows = messages.map((m) =>
      [
        m.id,
        m.conversationId,
        `"${(m.conversation.contact.name || '').replace(/"/g, '""')}"`,
        m.messageType,
        `"${(m.content || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        m.createdAt.toISOString(),
      ].join(','),
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=messages.csv');
    res.send(header + rows);
  }
}
