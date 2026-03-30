import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InboxesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(accountId: number) {
    return this.prisma.inbox.findMany({ where: { accountId } });
  }

  findOne(id: number, accountId: number) {
    return this.prisma.inbox.findFirst({ where: { id, accountId } });
  }

  create(
    accountId: number,
    data: {
      name: string;
      channelType: string;
      channelConfig: Record<string, string>;
      greeting?: string;
      aiEnabled?: boolean;
      aiPrompt?: string;
    },
  ) {
    return this.prisma.inbox.create({
      data: { accountId, ...data },
    });
  }

  update(
    id: number,
    accountId: number,
    data: {
      name?: string;
      channelConfig?: Record<string, string>;
      enabled?: boolean;
      greeting?: string;
      aiEnabled?: boolean;
      aiPrompt?: string;
    },
  ) {
    return this.prisma.inbox.updateMany({
      where: { id, accountId },
      data,
    });
  }

  delete(id: number, accountId: number) {
    return this.prisma.inbox.deleteMany({ where: { id, accountId } });
  }
}
