import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(accountId: number, page = 1, limit = 50) {
    return this.prisma.contact.findMany({
      where: { accountId },
      include: {
        contactInboxes: { include: { inbox: { select: { id: true, name: true, channelType: true } } } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOne(id: number, accountId: number) {
    return this.prisma.contact.findFirst({
      where: { id, accountId },
      include: {
        contactInboxes: { include: { inbox: true } },
        conversations: { orderBy: { lastActivityAt: 'desc' }, take: 10 },
      },
    });
  }

  update(id: number, accountId: number, data: { name?: string; email?: string; phone?: string }) {
    return this.prisma.contact.updateMany({ where: { id, accountId }, data });
  }
}
