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

function matchesImageSignature(mimeType: string, bytes: Buffer): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return bytes.length >= 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}

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
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        typeof input.captureSessionId !== 'string' ||
        input.captureSessionId.trim().length === 0 || input.captureSessionId.length > 128 ||
        !Array.isArray(input.images) ||
        input.images.length === 0 || input.images.length > MAX_IMAGES_PER_REQUEST) {
      throw new Error(`A shelf analysis requires a session ID and 1-${MAX_IMAGES_PER_REQUEST} images`);
    }

    const imageIds = input.images.map((image) => image?.imageId);
    if (imageIds.some((id) => typeof id !== 'string' || id.trim().length === 0 || id.length > 128) ||
        new Set(imageIds).size !== imageIds.length) {
      throw new Error('Each image must have a unique, non-empty imageId of at most 128 characters');
    }

    let totalBytes = 0;
    for (const image of input.images) {
      if (!image || typeof image !== 'object') {
        throw new Error('Each image must be an object');
      }
      if (!this.getCapabilities().supportedMimeTypes.includes(image.mimeType)) {
        throw new Error(`Unsupported image MIME type: ${image.mimeType}`);
      }
      if (typeof image.dataBase64 !== 'string' || image.dataBase64.length === 0 ||
          image.dataBase64.length % 4 !== 0 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.dataBase64)) {
        throw new Error('Image data must be canonical base64');
      }
      const decoded = Buffer.from(image.dataBase64, 'base64');
      if (decoded.length === 0 || decoded.toString('base64') !== image.dataBase64) {
        throw new Error('Image data must be canonical base64');
      }
      if (!matchesImageSignature(image.mimeType, decoded)) {
        throw new Error(`Image content does not match declared MIME type: ${image.mimeType}`);
      }
      totalBytes += decoded.length;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new Error('Combined shelf images exceed the 20 MiB request limit');
      }
    }

    if (input.storeCatalogHints !== undefined &&
        (!Array.isArray(input.storeCatalogHints) || input.storeCatalogHints.length > 200)) {
      throw new Error('storeCatalogHints must contain at most 200 entries');
    }
    for (const hint of input.storeCatalogHints ?? []) {
      if (!hint || typeof hint.productId !== 'string' || hint.productId.length === 0 ||
          hint.productId.length > 128 || typeof hint.displayName !== 'string' ||
          hint.displayName.trim().length === 0 || hint.displayName.length > 200 ||
          (hint.brand !== undefined && (typeof hint.brand !== 'string' || hint.brand.length > 120)) ||
          (hint.barcode !== undefined && (typeof hint.barcode !== 'string' || hint.barcode.length > 64))) {
        throw new Error('A store catalog hint contains invalid fields');
      }
    }

    const catalogHints = input.storeCatalogHints ?? [];
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
          detectionIds: ['detection-id', 'another-detection-id'],
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
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );

    if (!response.ok) {
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
