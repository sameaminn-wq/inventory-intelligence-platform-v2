import { ShelfAnalysisResult } from './ai-provider.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Validate the minimum domain invariants before a provider result can leave the AI boundary. */
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
    if (!Array.isArray(raw.reviewReasons) || !raw.reviewReasons.every((item) => typeof item === 'string')) {
      throw new Error(`Observation ${index} has invalid review reasons`);
    }
    return raw;
  });

  const detectionIds = new Set(observations.map((item) => item.detectionId as string));
  const crossViewMatches = value.crossViewMatches.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.matchGroupId !== 'string' ||
        !Array.isArray(raw.detectionIds) || !raw.detectionIds.every((id) => typeof id === 'string') ||
        !isConfidence(raw.matchConfidence) || typeof raw.rationale !== 'string') {
      throw new Error(`Invalid cross-view match at index ${index}`);
    }
    if (!raw.detectionIds.every((id) => detectionIds.has(id as string))) {
      throw new Error(`Cross-view match ${index} references an unknown detection`);
    }
    return raw;
  });

  if (!Array.isArray(value.unmatchedDetectionIds) ||
      !value.unmatchedDetectionIds.every((id) => typeof id === 'string' && detectionIds.has(id))) {
    throw new Error('AI provider returned invalid unmatched detection references');
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
