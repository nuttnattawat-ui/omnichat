import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    accountId: number,
    filters?: { status?: string; inboxId?: number; assigneeId?: number },
    page = 1,
    limit = 25,
  ) {
    return this.prisma.conversation.findMany({
      where: {
        accountId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.inboxId && { inboxId: filters.inboxId }),
        ...(filters?.assigneeId && { assigneeId: filters.assigneeId }),
      },
      include: {
        contact: { select: { id: true, name: true, avatarUrl: true } },
        inbox: { select: { id: true, name: true, channelType: true } },
        assignee: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        labels: { include: { label: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  findOne(id: number, accountId: number) {
    return this.prisma.conversation.findFirst({
      where: { id, accountId },
      include: {
        contact: { include: { contactInboxes: true } },
        inbox: true,
        assignee: { select: { id: true, name: true } },
      },
    });
  }

  updateStatus(id: number, accountId: number, status: string) {
    return this.prisma.conversation.updateMany({
      where: { id, accountId },
      data: { status },
    });
  }

  assign(id: number, accountId: number, assigneeId: number | null) {
    return this.prisma.conversation.updateMany({
      where: { id, accountId },
      data: { assigneeId },
    });
  }
}
