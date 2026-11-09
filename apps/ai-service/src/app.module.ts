import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';
import { ShelfAnalysisController } from './shelf-analysis.controller';

@Module({
  imports: [AiModule],
  controllers: [HealthController, ShelfAnalysisController],
})
export class AppModule {}
