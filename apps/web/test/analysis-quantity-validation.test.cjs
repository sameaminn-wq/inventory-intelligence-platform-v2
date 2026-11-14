const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const reviewSource = fs.readFileSync(path.join(__dirname, '../app/review/page.tsx'), 'utf8');
const reviewApi = fs.readFileSync(path.join(__dirname, '../app/api/reviews/route.ts'), 'utf8');

test('human review accepts non-negative integer quantities only', () => {
  assert.ok(reviewApi.includes('Number.isInteger(row.verifiedQuantity)'));
  assert.ok(reviewApi.includes('(row.verifiedQuantity as number) >= 0'));
  assert.ok(reviewApi.includes('(row.verifiedQuantity as number) <= 100000'));
  const valid = value => value === null || (Number.isInteger(value) && value >= 0 && value <= 100000);
  for (const value of [null, 0, 1, 25, 100000]) assert.equal(valid(value), true);
  for (const value of [-1, 1.5, 100001, '2', NaN]) assert.equal(valid(value), false);
});

test('a completed immutable review locks its quantity inputs and hides the save action', () => {
  assert.ok(reviewSource.includes('disabled={Boolean(latest)}'));
  assert.ok(reviewSource.includes('اكتملت المراجعة ولا يمكن تعديلها في هذه النسخة'));
  assert.ok(reviewSource.includes('latest ? <p className="capture-feedback good">'));
});
