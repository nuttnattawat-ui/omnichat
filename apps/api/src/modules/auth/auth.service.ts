import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    name: string;
    accountName?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create account + user in transaction
    const result = await this.prisma.$transaction(async (tx: PrismaClient) => {
      const account = await tx.account.create({
        data: { name: data.accountName || `${data.name}'s Team` },
      });

      const user = await tx.user.create({
        data: {
          accountId: account.id,
          email: data.email,
          password: hashedPassword,
          name: data.name,
          role: 'admin',
        },
      });

      return { account, user };
    });

    return this.generateTokens(result.user.id, result.user.accountId);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.accountId);
  }

  private generateTokens(userId: number, accountId: number) {
    const payload = { sub: userId, accountId };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
    };
  }
}
