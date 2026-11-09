export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export interface ShelfImageInput {
  imageId: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Base64 image bytes supplied by a trusted Core API/storage adapter. */
  dataBase64: string;
}

export interface AnalyzeShelfInput {
  captureSessionId: string;
  /** All images must belong to the same authorized shelf capture session. */
  images: ShelfImageInput[];
  storeCatalogHints?: Array<{
    productId: string;
    displayName: string;
    brand?: string;
    barcode?: string;
  }>;
}

export interface ShelfDetection {
  detectionId: string;
  sourceImageId: string;
  candidateProductName: string | null;
  brand: string | null;
  packageDescription: string | null;
  /** null means unknown/not reliably countable; it does not mean zero. */
  estimatedVisibleQuantity: number | null;
  identityConfidence: number;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  reviewReasons: string[];
}

export interface CrossViewMatch {
  matchGroupId: string;
  detectionIds: string[];
  matchConfidence: number;
  rationale: string;
}

export interface ShelfAnalysisResult {
  schemaVersion: '1.0';
  captureSessionId: string;
  provider: AiProviderId;
  model: string;
  observations: ShelfDetection[];
  crossViewMatches: CrossViewMatch[];
  unmatchedDetectionIds: string[];
  warnings: string[];
  reviewRequired: boolean;
}

export interface AiProviderCapabilities {
  provider: AiProviderId;
  imageInputs: boolean;
  maxImagesPerRequest: number;
  supportedMimeTypes: readonly string[];
  structuredJsonOutput: boolean;
}

export interface AiProvider {
  readonly id: AiProviderId;
  getCapabilities(): AiProviderCapabilities;
  analyzeShelf(input: AnalyzeShelfInput): Promise<ShelfAnalysisResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
