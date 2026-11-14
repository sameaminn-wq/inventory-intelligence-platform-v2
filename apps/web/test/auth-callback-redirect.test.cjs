const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const callbackSource = fs.readFileSync(
  path.join(__dirname, '../app/auth/callback/route.ts'),
  'utf8',
);

function safeInternalRedirect(requestUrl, requested) {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') ||
      requested.includes('\\') || /[\u0000-\u001f\u007f]/.test(requested)) return '/';
  try {
    const origin = new URL(requestUrl).origin;
    const target = new URL(requested, requestUrl);
    if (target.origin !== origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

test('callback validates redirects against the request origin', () => {
  assert.ok(callbackSource.includes('function safeInternalRedirect'));
  assert.ok(callbackSource.includes("requested.startsWith('//')"));
  assert.ok(callbackSource.includes("requested.includes('\\\\')"));
  assert.ok(callbackSource.includes('target.origin !== requestOrigin'));
  assert.ok(callbackSource.includes('const next = safeInternalRedirect(request)'));
});

test('callback accepts safe internal paths and preserves query/hash', () => {
  const base = 'https://inventory.example/auth/callback?code=abc';
  assert.equal(safeInternalRedirect(base, '/team'), '/team');
  assert.equal(safeInternalRedirect(base, '/team?tab=members#invite'), '/team?tab=members#invite');
  assert.equal(safeInternalRedirect(base, '/'), '/');
});

test('callback rejects external, protocol-relative, backslash, and control-character redirects', () => {
  const base = 'https://inventory.example/auth/callback';
  for (const value of [
    'https://evil.example',
    '//evil.example/path',
    '/\\\\evil.example',
    '/\\evil.example',
    '/\u0000evil',
  ]) {
    assert.equal(safeInternalRedirect(base, value), '/', JSON.stringify(value));
  }
  assert.equal(safeInternalRedirect(base, 'team'), '/');
  assert.equal(safeInternalRedirect(base, ''), '/');
});
