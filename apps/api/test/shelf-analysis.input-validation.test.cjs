const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAnalyzeShelfInput } = require('../dist/ai/shelf-analysis.input-validation.js');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]).toString('base64');
const image = (imageId = 'image-1') => ({ imageId, mimeType: 'image/jpeg', dataBase64: jpeg });
const request = (images = [image()]) => ({ captureSessionId: 'session-1', images });

test('accepts a bounded request with valid image signatures', () => {
  const result = validateAnalyzeShelfInput(request([image('a'), image('b')]));
  assert.equal(result.captureSessionId, 'session-1');
  assert.deepEqual(result.images.map((item) => item.imageId), ['a', 'b']);
});

test('rejects missing session identifiers and empty image arrays', () => {
  assert.throws(() => validateAnalyzeShelfInput({ captureSessionId: ' ', images: [image()] }));
  assert.throws(() => validateAnalyzeShelfInput({ captureSessionId: 'session-1', images: [] }));
});

test('rejects duplicate image identifiers', () => {
  assert.throws(() => validateAnalyzeShelfInput(request([image('same'), image('same')])), /unique/);
});

test('rejects unsupported MIME types and mismatched file signatures', () => {
  assert.throws(() => validateAnalyzeShelfInput(request([{ ...image(), mimeType: 'image/gif' }])), /MIME/);
  assert.throws(() => validateAnalyzeShelfInput(request([{ ...image(), mimeType: 'image/png' }])), /does not match/);
});

test('rejects malformed or non-canonical base64', () => {
  assert.throws(() => validateAnalyzeShelfInput(request([{ ...image(), dataBase64: 'not base64!' }])), /base64/);
});

test('rejects more than eight images', () => {
  assert.throws(() => validateAnalyzeShelfInput(request(Array.from({ length: 9 }, (_, i) => image('i-' + i)))), /1-8/);
});

test('rejects oversized combined image payloads', () => {
  const large = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(21 * 1024 * 1024)]).toString('base64');
  assert.throws(() => validateAnalyzeShelfInput(request([{ imageId: 'large', mimeType: 'image/jpeg', dataBase64: large }, image('small')])), /20 MiB/);
});

test('validates optional catalog hints without coercing values', () => {
  const valid = validateAnalyzeShelfInput({ ...request(), storeCatalogHints: [{ productId: 'p1', displayName: 'Tea', brand: 'Brand' }] });
  assert.equal(valid.storeCatalogHints[0].displayName, 'Tea');
  assert.throws(() => validateAnalyzeShelfInput({ ...request(), storeCatalogHints: [{ productId: 'p1', displayName: ' ' }] }));
});
