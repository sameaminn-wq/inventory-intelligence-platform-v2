import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiServiceClient } from './ai-service.client';
import { AnalyzeShelfInput } from './ai-provider.types';
import { CoreInternalTokenGuard } from './core-internal-token.guard';

@Controller('api/v1/internal/shelf-analyses')
@UseGuards(CoreInternalTokenGuard)
export class ShelfAnalysisController {
  constructor(private readonly aiService: AiServiceClient) {}

  @Post()
  analyze(@Body() input: AnalyzeShelfInput) {
    return this.aiService.analyzeShelf(input);
  }
}
