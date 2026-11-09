import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiServiceClient } from './ai-service.client';
import { AnalyzeShelfInput } from './ai-provider.types';
import { CoreInternalTokenGuard } from './core-internal-token.guard';
import { validateAnalyzeShelfInput } from './shelf-analysis.input-validation';

@Controller('api/v1/internal/shelf-analyses')
@UseGuards(CoreInternalTokenGuard)
export class ShelfAnalysisController {
  constructor(private readonly aiService: AiServiceClient) {}

  @Post()
  analyze(@Body() input: AnalyzeShelfInput) {
    try {
      const validated = validateAnalyzeShelfInput(input);
      return this.aiService.analyzeShelf(validated);
    } catch (error) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Invalid shelf analysis request');
    }
  }
}
