import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

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
}
