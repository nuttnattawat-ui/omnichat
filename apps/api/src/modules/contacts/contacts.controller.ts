import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(
    @Req() req: { user: { accountId: number } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.findAll(
      req.user.accountId,
      parseInt(page || '1'),
      parseInt(limit || '50'),
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
  ) {
    return this.contactsService.findOne(id, req.user.accountId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { accountId: number } },
    @Body() body: { name?: string; email?: string; phone?: string },
  ) {
    return this.contactsService.update(id, req.user.accountId, body);
  }
}
