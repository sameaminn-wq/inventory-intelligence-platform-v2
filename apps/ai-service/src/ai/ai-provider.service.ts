import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER, AiProvider, AnalyzeShelfInput, ShelfAnalysisResult } from './ai-provider.types';

@Injectable()
export class AiProviderService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  getCapabilities() {
    return this.provider.getCapabilities();
  }

  analyzeShelf(input: AnalyzeShelfInput): Promise<ShelfAnalysisResult> {
    return this.provider.analyzeShelf(input);
  }
}
