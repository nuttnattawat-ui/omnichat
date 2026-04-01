import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Get current user profile */
  @Get('profile')
  async getProfile(@Req() req: { user: { userId: number } }) {
    return this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        account: { select: { id: true, name: true, plan: true } },
      },
    });
  }

  /** Update current user profile */
  @Patch('profile')
  async updateProfile(
    @Req() req: { user: { userId: number } },
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: body,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }

  /** Get all team members */
  @Get('team')
  async getTeam(@Req() req: { user: { accountId: number } }) {
    return this.prisma.user.findMany({
      where: { accountId: req.user.accountId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
      },
    });
  }

  /** Invite a new team member */
  @Post('team/invite')
  async inviteTeamMember(
    @Req() req: { user: { accountId: number } },
    @Body() body: { name: string; email: string; role?: string },
  ) {
    if (!body.name?.trim() || !body.email?.trim()) {
      throw new BadRequestException('Name and email are required');
    }

    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // Create user with temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        accountId: req.user.accountId,
        email: body.email.trim(),
        name: body.name.trim(),
        password: hashedPassword,
        role: body.role || 'agent',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return { ...user, tempPassword };
  }
}
