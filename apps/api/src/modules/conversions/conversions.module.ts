import { Module } from '@nestjs/common';
import { ConversionsController } from './conversions.controller';

@Module({
  controllers: [ConversionsController],
})
export class ConversionsModule {}
