import { Injectable, BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { AnalyzeShelfInput, ShelfAnalysisResult } from './ai-provider.types';

@Injectable()
export class AiServiceClient {
  async analyzeShelf(input: AnalyzeShelfInput): Promise<ShelfAnalysisResult> {
    const baseUrl = process.env.AI_SERVICE_URL;
    const token = process.env.AI_SERVICE_TOKEN;
    if (!baseUrl || !token) {
      throw new ServiceUnavailableException('AI analysis is not configured');
    }

    let endpoint: URL;
    try {
      endpoint = new URL('/internal/v1/analyses', baseUrl);
    } catch {
      throw new ServiceUnavailableException('AI analysis endpoint is invalid');
    }
    if (!['http:', 'https:'].includes(endpoint.protocol) ||
        (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:')) {
      throw new ServiceUnavailableException('AI analysis endpoint must use HTTPS in production');
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-token': token,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(95_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('AI analysis timed out');
      }
      throw new BadGatewayException('AI analysis service is unavailable');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException('AI service authentication is not configured correctly');
      }
      if (response.status === 429) {
        throw new GatewayTimeoutException('AI provider is temporarily rate limited');
      }
      if (response.status >= 500) {
        throw new BadGatewayException('AI analysis failed');
      }
      throw new BadGatewayException('AI analysis request was rejected');
    }

    try {
      return await response.json() as ShelfAnalysisResult;
    } catch {
      throw new BadGatewayException('AI service returned an invalid response');
    }
  }
}
