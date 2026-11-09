import { Module } from '@nestjs/common';
import { AiServiceClient } from './ai-service.client';
import { ShelfAnalysisController } from './shelf-analysis.controller';

@Module({
  controllers: [ShelfAnalysisController],
  providers: [AiServiceClient],
})
export class AiModule {}
