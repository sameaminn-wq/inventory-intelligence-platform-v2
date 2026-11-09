const test = require('node:test');
const assert = require('node:assert/strict');
const { GeminiProvider } = require('../dist/ai/providers/gemini.provider.js');

const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

const pngBytes = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const validInput = () => ({
  captureSessionId: 'session-gemini-test',
  images: [{ imageId: 'image-1', mimeType: 'image/png', dataBase64: pngBytes.toString('base64') }],
});

function validModelResult() {
  return {
    schemaVersion: '1.0',
    captureSessionId: 'session-gemini-test',
    observations: [{
      detectionId: 'd-1',
      sourceImageId: 'image-1',
      candidateProductName: 'Olive oil',
      brand: null,
      packageDescription: 'Bottle',
      estimatedVisibleQuantity: 3,
      identityConfidence: 0.9,
      boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.5 },
      reviewReasons: [],
    }],
    crossViewMatches: [],
    unmatchedDetectionIds: ['d-1'],
    warnings: [],
    reviewRequired: false,
  };
}

test.beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-secret-not-real';
  process.env.GEMINI_MODEL = 'test-model';
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

test('advertises image capabilities without exposing configuration', () => {
  const capabilities = new GeminiProvider().getCapabilities();
  assert.equal(capabilities.provider, 'gemini');
  assert.equal(capabilities.imageInputs, true);
  assert.equal(capabilities.maxImagesPerRequest, 8);
  assert.deepEqual(capabilities.supportedMimeTypes, ['image/jpeg', 'image/png', 'image/webp']);
});

test('rejects requests when Gemini credentials are not configured', async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => new GeminiProvider().analyzeShelf(validInput()), /not configured/);
});

test('rejects MIME spoofing before making a network request', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected network call'); };
  const input = validInput();
  input.images[0].mimeType = 'image/jpeg';
  await assert.rejects(() => new GeminiProvider().analyzeShelf(input), /does not match declared MIME type/);
  assert.equal(called, false);
});

test('rejects non-canonical base64 before making a network request', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected network call'); };
  const input = validInput();
  input.images[0].dataBase64 = '%%%not-base64%%%';
  await assert.rejects(() => new GeminiProvider().analyzeShelf(input), /canonical base64/);
  assert.equal(called, false);
});

test('rejects duplicate image IDs before making a network request', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected network call'); };
  const input = validInput();
  input.images.push({ ...input.images[0] });
  await assert.rejects(() => new GeminiProvider().analyzeShelf(input), /unique/);
  assert.equal(called, false);
});

test('sends image bytes using the API key header and validates the structured response', async () => {
  let requestUrl;
  let requestOptions;
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validModelResult()) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await new GeminiProvider().analyzeShelf(validInput());
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'test-model');
  assert.equal(result.observations[0].candidateProductName, 'Olive oil');
  assert.equal(new URL(requestUrl).search, '');
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-secret-not-real');
  const sent = JSON.parse(requestOptions.body);
  assert.equal(sent.contents[0].parts[1].inline_data.data, pngBytes.toString('base64'));
});

test('does not leak upstream response bodies or credentials in HTTP errors', async () => {
  global.fetch = async () => new Response('sensitive upstream payload', { status: 429 });
  await assert.rejects(
    () => new GeminiProvider().analyzeShelf(validInput()),
    (error) => error.message === 'Gemini request failed with HTTP 429' &&
      !error.message.includes('sensitive') && !error.message.includes('test-secret-not-real'),
  );
});

test('rejects malformed JSON returned by the model', async () => {
  global.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{bad json' }] } }],
  }), { status: 200 });
  await assert.rejects(() => new GeminiProvider().analyzeShelf(validInput()), /malformed JSON/);
});

test('rejects a model response that references another capture session', async () => {
  const payload = validModelResult();
  payload.captureSessionId = 'wrong-session';
  global.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
  }), { status: 200 });
  await assert.rejects(() => new GeminiProvider().analyzeShelf(validInput()), /mismatched capture session/);
});
