import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  getMyAccount(@Req() req: { user: { accountId: number } }) {
    return this.accountsService.findOne(req.user.accountId);
  }

  @Patch('me')
  updateMyAccount(
    @Req() req: { user: { accountId: number } },
    @Body() body: { name?: string },
  ) {
    return this.accountsService.update(req.user.accountId, body);
  }
}
