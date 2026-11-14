const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/api/analyze/route.ts'), 'utf8');

test('cleans up already uploaded shelf images when a later upload fails', () => {
  const uploadFailure = source.indexOf("if (uploadError)");
  const cleanup = source.indexOf(".remove(imageAssets.map((asset) => asset.path))", uploadFailure);
  const response = source.indexOf("تعذر حفظ إحدى صور الجلسة", uploadFailure);
  assert.ok(uploadFailure >= 0 && cleanup > uploadFailure && response > cleanup);
});

test('cleans up shelf images when analysis session persistence fails', () => {
  const persistenceFailure = source.indexOf("if (persistError || !persistedSession)");
  const cleanup = source.indexOf(".remove(imageAssets.map((asset) => asset.path))", persistenceFailure);
  const response = source.indexOf("تعذر حفظ النتيجة بشكل دائم", persistenceFailure);
  assert.ok(persistenceFailure >= 0 && cleanup > persistenceFailure && response > cleanup);
});
