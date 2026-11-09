import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiProviderService } from './ai/ai-provider.service';
import { AnalyzeShelfInput } from './ai/ai-provider.types';
import { ServiceTokenGuard } from './service-token.guard';

@Controller('internal/v1/analyses')
@UseGuards(ServiceTokenGuard)
export class ShelfAnalysisController {
  constructor(private readonly aiProvider: AiProviderService) {}

  @Post()
  analyze(@Body() input: AnalyzeShelfInput) {
    return this.aiProvider.analyzeShelf(input);
  }
}
