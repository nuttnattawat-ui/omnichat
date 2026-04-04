import { Module } from '@nestjs/common';
import { CsatController } from './csat.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CsatController],
})
export class CsatModule {}
