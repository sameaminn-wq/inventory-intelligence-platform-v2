const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const analysisSource = fs.readFileSync(
  path.join(__dirname, '../app/analysis/page.tsx'),
  'utf8',
);

test('analysis review accepts non-negative integer quantities only', () => {
  assert.ok(
    analysisSource.includes('!/^\\d+$/.test(value)'),
    'analysis page must validate quantities with a digit-only regular expression',
  );

  const quantityPattern = /^\d+$/;
  for (const value of ['0', '1', '25', '100000']) {
    assert.equal(quantityPattern.test(value), true);
  }
  for (const value of ['', '-1', '1.5', '1a', ' 2']) {
    assert.equal(quantityPattern.test(value), false);
  }
});
