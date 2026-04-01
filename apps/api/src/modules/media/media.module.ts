import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { LineAdapter } from '../../adapters/line.adapter';

@Module({
  controllers: [MediaController],
  providers: [LineAdapter],
})
export class MediaModule {}
