const test = require('node:test');
const assert = require('node:assert/strict');
const { AiServiceClient } = require('../dist/ai/ai-service.client.js');

const originalFetch = global.fetch;
const originalUrl = process.env.AI_SERVICE_URL;
const originalToken = process.env.AI_SERVICE_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;

test.beforeEach(() => {
  process.env.AI_SERVICE_URL = 'https://ai.internal.example';
  process.env.AI_SERVICE_TOKEN = 'test-internal-token';
  process.env.NODE_ENV = 'test';
});

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    AI_SERVICE_URL: originalUrl,
    AI_SERVICE_TOKEN: originalToken,
    NODE_ENV: originalNodeEnv,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('fails closed when AI service configuration is missing', async () => {
  delete process.env.AI_SERVICE_TOKEN;
  await assert.rejects(
    () => new AiServiceClient().analyzeShelf({ captureSessionId: 's', images: [] }),
    (error) => error.status === 503,
  );
});

test('forwards analysis only to configured internal endpoint with service token header', async () => {
  let captured;
  const expected = {
    schemaVersion: '1.0',
    captureSessionId: 'session-1',
    provider: 'gemini',
    model: 'test-model',
    observations: [],
    crossViewMatches: [],
    unmatchedDetectionIds: [],
    warnings: [],
    reviewRequired: true,
  };
  global.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify(expected), { status: 200 });
  };
  const input = { captureSessionId: 'session-1', images: [] };
  const result = await new AiServiceClient().analyzeShelf(input);
  assert.equal(captured.url, 'https://ai.internal.example/internal/v1/analyses');
  assert.equal(captured.options.headers['x-internal-service-token'], 'test-internal-token');
  assert.equal(captured.options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(captured.options.body), input);
  assert.equal(result.captureSessionId, 'session-1');
});

test('requires HTTPS when running in production', async () => {
  process.env.NODE_ENV = 'production';
  process.env.AI_SERVICE_URL = 'http://ai.internal.example';
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected'); };
  await assert.rejects(
    () => new AiServiceClient().analyzeShelf({ captureSessionId: 's', images: [] }),
    (error) => error.status === 503,
  );
  assert.equal(called, false);
});

test('does not expose upstream authentication response bodies', async () => {
  global.fetch = async () => new Response('private token diagnostics', { status: 401 });
  await assert.rejects(
    () => new AiServiceClient().analyzeShelf({ captureSessionId: 's', images: [] }),
    (error) => error.status === 503 &&
      !error.message.includes('private token diagnostics') &&
      !error.message.includes('test-internal-token'),
  );
});

test('maps upstream failures to a safe gateway error', async () => {
  global.fetch = async () => new Response('provider secret details', { status: 500 });
  await assert.rejects(
    () => new AiServiceClient().analyzeShelf({ captureSessionId: 's', images: [] }),
    (error) => error.status === 502 && !error.message.includes('provider secret details'),
  );
});
