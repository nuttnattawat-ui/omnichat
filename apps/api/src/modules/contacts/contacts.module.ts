import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { LineAdapter } from '../../adapters/line.adapter';
import { FacebookAdapter } from '../../adapters/facebook.adapter';

@Module({
  providers: [ContactsService, LineAdapter, FacebookAdapter],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}
