import { ShelfAnalysisResult } from './ai-provider.types';

const MAX_OBSERVATIONS = 500;
const MAX_MATCH_GROUPS = 250;
const MAX_DETECTIONS_PER_MATCH = 32;
const MAX_WARNINGS = 50;
const MAX_TEXT_LENGTH = 500;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isNullableString = (value: unknown, maxLength = MAX_TEXT_LENGTH): value is string | null =>
  value === null || (typeof value === 'string' && value.length <= maxLength);

const isStringList = (value: unknown, maxItems: number, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxItems &&
  value.every((item) => typeof item === 'string' && item.length <= maxLength);

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
  if (!Array.isArray(value.observations) || value.observations.length > MAX_OBSERVATIONS ||
      !Array.isArray(value.crossViewMatches) || value.crossViewMatches.length > MAX_MATCH_GROUPS) {
    throw new Error('AI provider result exceeds observation or cross-view match limits');
  }

  const allowedImageIds = new Set(expectedImageIds);
  if (allowedImageIds.size !== expectedImageIds.length) {
    throw new Error('Capture session contains duplicate image identifiers');
  }

  const observations = value.observations.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Invalid observation at index ${index}`);
    if (typeof raw.detectionId !== 'string' || raw.detectionId.length === 0 || raw.detectionId.length > 128) {
      throw new Error(`Observation ${index} has an invalid detectionId`);
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
    if (!isNullableString(raw.candidateProductName, 200) || !isNullableString(raw.brand, 120) ||
        !isNullableString(raw.packageDescription, 300) || !isBoundingBox(raw.boundingBox)) {
      throw new Error(`Observation ${index} has invalid product or bounding-box fields`);
    }
    if (!isStringList(raw.reviewReasons, 20, 120)) {
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
  const matchGroupIds = new Set<string>();
  const observationById = new Map(observations.map((item) => [item.detectionId as string, item]));
  const crossViewMatches = value.crossViewMatches.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.matchGroupId !== 'string' ||
        raw.matchGroupId.length === 0 || raw.matchGroupId.length > 128 ||
        matchGroupIds.has(raw.matchGroupId) ||
        !Array.isArray(raw.detectionIds) || raw.detectionIds.length < 2 ||
        raw.detectionIds.length > MAX_DETECTIONS_PER_MATCH ||
        !raw.detectionIds.every((id) => typeof id === 'string' && id.length <= 128) ||
        new Set(raw.detectionIds).size !== raw.detectionIds.length ||
        !isConfidence(raw.matchConfidence) ||
        typeof raw.rationale !== 'string' || raw.rationale.length > 1000) {
      throw new Error(`Invalid cross-view match at index ${index}`);
    }
    matchGroupIds.add(raw.matchGroupId);
    if (!raw.detectionIds.every((id) => detectionIds.has(id as string))) {
      throw new Error(`Cross-view match ${index} references an unknown detection`);
    }
    const sourceImages = new Set<string>();
    for (const id of raw.detectionIds as string[]) {
      if (matchedDetectionIds.has(id)) {
        throw new Error(`Detection ${id} appears in more than one cross-view match group`);
      }
      matchedDetectionIds.add(id);
      const observation = observationById.get(id);
      if (observation) sourceImages.add(observation.sourceImageId as string);
    }
    if (sourceImages.size < 2) {
      throw new Error(`Cross-view match ${index} must link detections from at least two different images`);
    }
    return raw;
  });

  if (!Array.isArray(value.unmatchedDetectionIds) ||
      value.unmatchedDetectionIds.length > MAX_OBSERVATIONS ||
      !value.unmatchedDetectionIds.every((id) => typeof id === 'string' && detectionIds.has(id)) ||
      new Set(value.unmatchedDetectionIds).size !== value.unmatchedDetectionIds.length ||
      value.unmatchedDetectionIds.some((id) => matchedDetectionIds.has(id as string))) {
    throw new Error('AI provider returned invalid or conflicting unmatched detection references');
  }
  if (!isStringList(value.warnings, MAX_WARNINGS, MAX_TEXT_LENGTH) ||
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
