const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/api/analyze/route.ts'), 'utf8');

test('cleans up already uploaded shelf images when a later upload fails', () => {
  const uploadFailure = source.indexOf('if (uploadError)');
  const cleanup = source.indexOf('await cleanupUploadedAssets(imageAssets.map((asset) => asset.path));', uploadFailure);
  const response = source.indexOf('تعذر حفظ إحدى صور الجلسة', uploadFailure);
  assert.ok(uploadFailure >= 0 && cleanup > uploadFailure && response > cleanup);
});

test('cleans up shelf images when analysis session persistence fails', () => {
  const persistenceFailure = source.indexOf('if (persistError || !persistedSession)');
  const cleanup = source.indexOf('await cleanupUploadedAssets(imageAssets.map((asset) => asset.path));', persistenceFailure);
  const response = source.indexOf('تعذر حفظ النتيجة بشكل دائم', persistenceFailure);
  assert.ok(persistenceFailure >= 0 && cleanup > persistenceFailure && response > cleanup);
});

test('uses server-side storage privileges for cleanup and handles thrown failures', () => {
  assert.ok(source.includes('const admin = createAdminClient();'));
  assert.ok(source.includes("admin.storage.from('shelf-captures').remove(paths)"));
  assert.ok(source.includes('async function cleanupUploadedAssets(paths: string[])'));
  const catchStart = source.lastIndexOf('} catch (error) {');
  const cleanup = source.indexOf('await cleanupUploadedAssets(imageAssets.map((asset) => asset.path));', catchStart);
  assert.ok(catchStart >= 0 && cleanup > catchStart);
});
