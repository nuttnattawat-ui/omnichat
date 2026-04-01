import { Module } from '@nestjs/common';
import { CannedResponsesController } from './canned-responses.controller';

@Module({
  controllers: [CannedResponsesController],
})
export class CannedResponsesModule {}
