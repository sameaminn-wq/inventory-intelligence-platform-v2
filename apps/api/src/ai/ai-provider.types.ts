export interface AnalyzeShelfInput {
  captureSessionId: string;
  images: Array<{
    imageId: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    dataBase64: string;
  }>;
  storeCatalogHints?: Array<{
    productId: string;
    displayName: string;
    brand?: string;
    barcode?: string;
  }>;
}

export interface ShelfAnalysisResult {
  schemaVersion: '1.0';
  captureSessionId: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
  observations: Array<Record<string, unknown>>;
  crossViewMatches: Array<Record<string, unknown>>;
  unmatchedDetectionIds: string[];
  warnings: string[];
  reviewRequired: boolean;
}
