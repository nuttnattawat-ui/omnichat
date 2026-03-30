import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggest/:conversationId')
  async suggestReply(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body('prompt') prompt?: string,
  ) {
    const reply = await this.aiService.generateReply(
      conversationId,
      prompt,
    );
    return { suggestion: reply };
  }
}
