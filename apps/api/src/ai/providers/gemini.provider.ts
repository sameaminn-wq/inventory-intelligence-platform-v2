import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  AiProviderCapabilities,
  AnalyzeShelfInput,
  ShelfAnalysisResult,
} from '../ai-provider.types';
import { validateShelfAnalysisResult } from '../shelf-analysis.validation';

const MAX_IMAGES_PER_REQUEST = 8;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly id = 'gemini' as const;

  getCapabilities(): AiProviderCapabilities {
    return {
      provider: this.id,
      imageInputs: true,
      maxImagesPerRequest: MAX_IMAGES_PER_REQUEST,
      supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      structuredJsonOutput: true,
    };
  }

  async analyzeShelf(input: AnalyzeShelfInput): Promise<ShelfAnalysisResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL;
    if (!apiKey || !model) {
      throw new Error('Gemini provider is not configured; set GEMINI_API_KEY and GEMINI_MODEL');
    }
    if (!input.captureSessionId || input.images.length === 0 ||
        input.images.length > MAX_IMAGES_PER_REQUEST) {
      throw new Error(`A shelf analysis requires 1-${MAX_IMAGES_PER_REQUEST} images`);
    }

    const imageIds = input.images.map((image) => image.imageId);
    if (imageIds.some((id) => !id) || new Set(imageIds).size !== imageIds.length) {
      throw new Error('Each image must have a unique, non-empty imageId');
    }

    let totalBytes = 0;
    for (const image of input.images) {
      if (!this.getCapabilities().supportedMimeTypes.includes(image.mimeType)) {
        throw new Error(`Unsupported image MIME type: ${image.mimeType}`);
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image.dataBase64)) {
        throw new Error('Image data must be valid base64');
      }
      const estimatedBytes = Math.floor((image.dataBase64.length * 3) / 4);
      totalBytes += estimatedBytes;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) break;
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new Error('Combined shelf images exceed the 20 MiB request limit');
    }

    const catalogHints = input.storeCatalogHints?.slice(0, 200) ?? [];
    const prompt = [
      'You are analyzing multiple photographs of ONE physical retail shelf from different angles.',
      'Treat all images as complementary views of the same shelf, not separate inventories.',
      'Identify visible product observations and estimate visible quantities only when supported.',
      'Do not count the same physical item twice because it appears in multiple views.',
      'Preserve each observation sourceImageId. Create crossViewMatches only when evidence supports the same physical item.',
      'Keep product identity confidence separate from cross-view match confidence.',
      'Use null for unknown quantity; never invent a count for occluded or hidden products.',
      'Mark ambiguity, occlusion, blur, reflections, partial shelf coverage and conflicts for human review.',
      'Return only JSON matching this shape:',
      JSON.stringify({
        schemaVersion: '1.0',
        captureSessionId: input.captureSessionId,
        observations: [{
          detectionId: 'stable-id',
          sourceImageId: 'one-of-provided-image-ids',
          candidateProductName: 'string-or-null',
          brand: 'string-or-null',
          packageDescription: 'string-or-null',
          estimatedVisibleQuantity: 'integer-or-null',
          identityConfidence: 'number-0-to-1',
          boundingBox: { x: '0-to-1', y: '0-to-1', width: '0-to-1', height: '0-to-1' },
          reviewReasons: ['string'],
        }],
        crossViewMatches: [{
          matchGroupId: 'stable-id',
          detectionIds: ['detection-id'],
          matchConfidence: 'number-0-to-1',
          rationale: 'string',
        }],
        unmatchedDetectionIds: ['detection-id'],
        warnings: ['string'],
        reviewRequired: true,
      }),
      'Bounding boxes must be normalized to the source image dimensions. Use null when unsupported.',
      'Available image IDs in order: ' + input.images.map((image) => image.imageId).join(', '),
      'Optional store catalog hints (do not force a match): ' + JSON.stringify(catalogHints),
    ].join('\n');

    const parts = [
      { text: prompt },
      ...input.images.map((image) => ({
        inline_data: { mime_type: image.mimeType, data: image.dataBase64 },
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );

    if (!response.ok) {
      // Do not leak provider response bodies, which may contain sensitive diagnostics.
      throw new Error(`Gemini request failed with HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !('candidates' in payload)) {
      throw new Error('Gemini returned an invalid response envelope');
    }
    const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
    const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!text) throw new Error('Gemini returned no analysis content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned malformed JSON');
    }

    return validateShelfAnalysisResult(
      parsed,
      input.captureSessionId,
      input.images.map((image) => image.imageId),
      this.id,
      model,
    );
  }
}
