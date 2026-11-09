const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCaptureFrame } = require('../lib/capture-guidance.cjs');

test('requests pause when motion is too fast even if blur metric is unavailable', () => {
  const result = evaluateCaptureFrame({ motionScore: 0.9, coverageRatio: 0.3 });
  assert.equal(result.action, 'pause');
  assert.ok(result.reasons.includes('DEVICE_MOVING_TOO_FAST'));
});

test('rejects blurry frames before considering motion guidance', () => {
  const result = evaluateCaptureFrame({ motionScore: 0.1, blurScore: 0.1, glareRatio: 0.1 });
  assert.equal(result.action, 'retake');
  assert.ok(result.reasons.includes('BLUR_TOO_HIGH'));
});

test('asks user to change angle when glare is excessive', () => {
  const result = evaluateCaptureFrame({ blurScore: 0.9, glareRatio: 0.7 });
  assert.equal(result.action, 'retake');
  assert.ok(result.reasons.includes('GLARE_TOO_HIGH'));
});

test('requests overlap when moving to an adjacent shelf section', () => {
  const result = evaluateCaptureFrame({ blurScore: 0.9, overlapRatio: 0.05, coverageRatio: 0.6 });
  assert.equal(result.action, 'adjust_position');
  assert.ok(result.reasons.includes('INSUFFICIENT_VIEW_OVERLAP'));
});

test('flags excessive overlap so the worker can move forward', () => {
  const result = evaluateCaptureFrame({ blurScore: 0.9, overlapRatio: 0.9, coverageRatio: 0.6 });
  assert.equal(result.action, 'move_forward');
});

test('marks coverage complete but still requires review', () => {
  const result = evaluateCaptureFrame({ blurScore: 0.9, coverageRatio: 0.99 });
  assert.equal(result.action, 'complete');
  assert.equal(result.requiresHumanReview, true);
});

test('does not treat missing motion sensor data as zero motion', () => {
  const result = evaluateCaptureFrame({ blurScore: 0.9, coverageRatio: 0.2 });
  assert.equal(result.sensorStatus, 'unavailable');
  assert.notEqual(result.action, 'pause');
});

test('rejects invalid sensor and image measurements', () => {
  assert.throws(() => evaluateCaptureFrame({ motionScore: 2 }), /between 0 and 1/);
  assert.throws(() => evaluateCaptureFrame({ blurScore: -0.1 }), /between 0 and 1/);
});

test('rejects invalid threshold overrides', () => {
  assert.throws(() => evaluateCaptureFrame({}, { motionPause: 1.5 }), /Threshold motionPause/);
});
