import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('canned-responses')
@UseGuards(JwtAuthGuard)
export class CannedResponsesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() req: { user: { accountId: number } }) {
    return this.prisma.cannedResponse.findMany({
      where: { accountId: req.user.accountId },
      orderBy: { shortCode: 'asc' },
    });
  }

  @Post()
  create(
    @Req() req: { user: { accountId: number } },
    @Body() body: { shortCode: string; content: string },
  ) {
    return this.prisma.cannedResponse.create({
      data: {
        accountId: req.user.accountId,
        shortCode: body.shortCode,
        content: body.content,
      },
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: { shortCode?: string; content?: string },
  ) {
    return this.prisma.cannedResponse.updateMany({
      where: { id, accountId: req.user.accountId },
      data: body,
    });
  }

  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.prisma.cannedResponse.deleteMany({
      where: { id, accountId: req.user.accountId },
    });
  }
}
