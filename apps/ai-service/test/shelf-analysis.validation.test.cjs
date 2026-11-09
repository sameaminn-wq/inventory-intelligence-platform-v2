const test = require('node:test');
const assert = require('node:assert/strict');
const { validateShelfAnalysisResult } = require('../dist/ai/shelf-analysis.validation.js');

function validPayload() {
  return {
    schemaVersion: '1.0',
    captureSessionId: 'capture-001',
    observations: [
      {
        detectionId: 'detection-a',
        sourceImageId: 'image-a',
        candidateProductName: 'Tomato sauce',
        brand: null,
        packageDescription: 'Can',
        estimatedVisibleQuantity: 2,
        identityConfidence: 0.94,
        boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        reviewReasons: [],
      },
      {
        detectionId: 'detection-b',
        sourceImageId: 'image-b',
        candidateProductName: 'Tomato sauce',
        brand: null,
        packageDescription: 'Can',
        estimatedVisibleQuantity: 2,
        identityConfidence: 0.91,
        boundingBox: { x: 0.2, y: 0.2, width: 0.3, height: 0.4 },
        reviewReasons: [],
      },
      {
        detectionId: 'detection-c',
        sourceImageId: 'image-a',
        candidateProductName: null,
        brand: null,
        packageDescription: null,
        estimatedVisibleQuantity: null,
        identityConfidence: 0.2,
        boundingBox: null,
        reviewReasons: ['occluded'],
      },
    ],
    crossViewMatches: [
      {
        matchGroupId: 'match-001',
        detectionIds: ['detection-a', 'detection-b'],
        matchConfidence: 0.88,
        rationale: 'Same label and package appearance across two views',
      },
    ],
    unmatchedDetectionIds: ['detection-c'],
    warnings: [],
    reviewRequired: true,
  };
}

function validate(payload = validPayload()) {
  return validateShelfAnalysisResult(
    payload,
    'capture-001',
    ['image-a', 'image-b'],
    'gemini',
    'test-model',
  );
}

test('accepts a valid multi-view analysis and attaches trusted provider metadata', () => {
  const result = validate();
  assert.equal(result.captureSessionId, 'capture-001');
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'test-model');
  assert.equal(result.observations.length, 3);
});

test('rejects a result for a different capture session', () => {
  const payload = validPayload();
  payload.captureSessionId = 'another-session';
  assert.throws(() => validate(payload), /mismatched capture session/);
});

test('rejects duplicate detection identifiers', () => {
  const payload = validPayload();
  payload.observations[1].detectionId = 'detection-a';
  assert.throws(() => validate(payload), /duplicate detection identifiers/);
});

test('rejects cross-view matches whose detections come from one image only', () => {
  const payload = validPayload();
  payload.observations[1].sourceImageId = 'image-a';
  assert.throws(() => validate(payload), /at least two different images/);
});

test('rejects a detection reused across cross-view match groups', () => {
  const payload = validPayload();
  payload.observations.push({
    ...payload.observations[1],
    detectionId: 'detection-d',
    sourceImageId: 'image-b',
  });
  payload.crossViewMatches.push({
    matchGroupId: 'match-002',
    detectionIds: ['detection-a', 'detection-d'],
    matchConfidence: 0.7,
    rationale: 'Conflicting duplicate group',
  });
  assert.throws(() => validate(payload), /more than one cross-view match group/);
});

test('rejects detections marked as both matched and unmatched', () => {
  const payload = validPayload();
  payload.unmatchedDetectionIds = ['detection-a'];
  assert.throws(() => validate(payload), /invalid or conflicting unmatched/);
});

test('rejects bounding boxes outside normalized image coordinates', () => {
  const payload = validPayload();
  payload.observations[0].boundingBox = { x: 0.8, y: 0.2, width: 0.4, height: 0.2 };
  assert.throws(() => validate(payload), /invalid product or bounding-box fields/);
});

test('rejects references to images outside the authorized capture session', () => {
  const payload = validPayload();
  payload.observations[0].sourceImageId = 'untrusted-image';
  assert.throws(() => validate(payload), /outside the capture session/);
});

test('rejects duplicate image identifiers in the trusted request context', () => {
  const payload = validPayload();
  assert.throws(() => validateShelfAnalysisResult(
    payload,
    'capture-001',
    ['image-a', 'image-a'],
    'gemini',
    'test-model',
  ), /duplicate image identifiers/);
});
