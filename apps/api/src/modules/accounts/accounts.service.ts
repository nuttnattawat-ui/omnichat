import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: number) {
    return this.prisma.account.findUnique({
      where: { id },
      include: { inboxes: true, users: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  update(id: number, data: { name?: string; plan?: string }) {
    return this.prisma.account.update({ where: { id }, data });
  }
}
