import { Module } from '@nestjs/common';
import { LabelsController } from './labels.controller';

@Module({
  controllers: [LabelsController],
})
export class LabelsModule {}
