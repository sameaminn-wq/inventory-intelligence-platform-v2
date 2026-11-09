import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.types';
import { AiProviderService } from './ai-provider.service';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  providers: [
    GeminiProvider,
    AiProviderService,
    { provide: AI_PROVIDER, useExisting: GeminiProvider },
  ],
  exports: [AiProviderService],
})
export class AiModule {}
