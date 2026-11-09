import { ShelfAnalysisResult } from './ai-provider.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isBoundingBox = (value: unknown): boolean => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  const { x, y, width, height } = value;
  return [x, y, width, height].every((part) => typeof part === 'number' && Number.isFinite(part)) &&
    (x as number) >= 0 && (y as number) >= 0 &&
    (width as number) > 0 && (height as number) > 0 &&
    (x as number) + (width as number) <= 1 &&
    (y as number) + (height as number) <= 1;
};

export function validateShelfAnalysisResult(
  value: unknown,
  expectedSessionId: string,
  expectedImageIds: readonly string[],
  provider: ShelfAnalysisResult['provider'],
  model: string,
): ShelfAnalysisResult {
  if (!isRecord(value) || value.schemaVersion !== '1.0') {
    throw new Error('AI provider returned an unsupported result schema');
  }
  if (value.captureSessionId !== expectedSessionId) {
    throw new Error('AI provider returned a mismatched capture session');
  }
  if (!Array.isArray(value.observations) || !Array.isArray(value.crossViewMatches)) {
    throw new Error('AI provider result is missing observations or cross-view matches');
  }

  const allowedImageIds = new Set(expectedImageIds);
  if (allowedImageIds.size !== expectedImageIds.length) {
    throw new Error('Capture session contains duplicate image identifiers');
  }

  const observations = value.observations.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Invalid observation at index ${index}`);
    if (typeof raw.detectionId !== 'string' || !raw.detectionId) {
      throw new Error(`Observation ${index} has no detectionId`);
    }
    if (typeof raw.sourceImageId !== 'string' || !allowedImageIds.has(raw.sourceImageId)) {
      throw new Error(`Observation ${index} references an image outside the capture session`);
    }
    if (raw.estimatedVisibleQuantity !== null &&
        (!Number.isInteger(raw.estimatedVisibleQuantity) || (raw.estimatedVisibleQuantity as number) < 0)) {
      throw new Error(`Observation ${index} has an invalid quantity estimate`);
    }
    if (!isConfidence(raw.identityConfidence)) {
      throw new Error(`Observation ${index} has invalid identity confidence`);
    }
    if (!isNullableString(raw.candidateProductName) || !isNullableString(raw.brand) ||
        !isNullableString(raw.packageDescription) || !isBoundingBox(raw.boundingBox)) {
      throw new Error(`Observation ${index} has invalid product or bounding-box fields`);
    }
    if (!Array.isArray(raw.reviewReasons) || !raw.reviewReasons.every((item) => typeof item === 'string')) {
      throw new Error(`Observation ${index} has invalid review reasons`);
    }
    return raw;
  });

  const detectionIdList = observations.map((item) => item.detectionId as string);
  const detectionIds = new Set(detectionIdList);
  if (detectionIds.size !== detectionIdList.length) {
    throw new Error('AI provider returned duplicate detection identifiers');
  }

  const matchedDetectionIds = new Set<string>();
  const crossViewMatches = value.crossViewMatches.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.matchGroupId !== 'string' || raw.matchGroupId.length === 0 ||
        !Array.isArray(raw.detectionIds) || raw.detectionIds.length < 2 ||
        !raw.detectionIds.every((id) => typeof id === 'string') ||
        new Set(raw.detectionIds).size !== raw.detectionIds.length ||
        !isConfidence(raw.matchConfidence) || typeof raw.rationale !== 'string') {
      throw new Error(`Invalid cross-view match at index ${index}`);
    }
    if (!raw.detectionIds.every((id) => detectionIds.has(id as string))) {
      throw new Error(`Cross-view match ${index} references an unknown detection`);
    }
    const sourceImages = new Set<string>();
    for (const id of raw.detectionIds as string[]) {
      if (matchedDetectionIds.has(id)) {
        throw new Error(`Detection ${id} appears in more than one cross-view match group`);
      }
      matchedDetectionIds.add(id);
      const observation = observations.find((item) => item.detectionId === id);
      if (observation) sourceImages.add(observation.sourceImageId as string);
    }
    if (sourceImages.size < 2) {
      throw new Error(`Cross-view match ${index} must link detections from at least two different images`);
    }
    return raw;
  });

  if (!Array.isArray(value.unmatchedDetectionIds) ||
      !value.unmatchedDetectionIds.every((id) => typeof id === 'string' && detectionIds.has(id)) ||
      new Set(value.unmatchedDetectionIds).size !== value.unmatchedDetectionIds.length ||
      value.unmatchedDetectionIds.some((id) => matchedDetectionIds.has(id as string))) {
    throw new Error('AI provider returned invalid or conflicting unmatched detection references');
  }
  if (!Array.isArray(value.warnings) || !value.warnings.every((item) => typeof item === 'string') ||
      typeof value.reviewRequired !== 'boolean') {
    throw new Error('AI provider returned invalid review metadata');
  }

  return {
    schemaVersion: '1.0',
    captureSessionId: expectedSessionId,
    provider,
    model,
    observations: observations as unknown as ShelfAnalysisResult['observations'],
    crossViewMatches: crossViewMatches as unknown as ShelfAnalysisResult['crossViewMatches'],
    unmatchedDetectionIds: value.unmatchedDetectionIds as string[],
    warnings: value.warnings as string[],
    reviewRequired: value.reviewRequired,
  };
}
