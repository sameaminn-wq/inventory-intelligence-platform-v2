const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const proxySource = fs.readFileSync(
  path.join(__dirname, '../lib/supabase/proxy.ts'),
  'utf8',
);

test('normalizes trailing slashes before classifying routes', () => {
  const normalizationLine = proxySource
    .split('\n')
    .find((line) => line.includes('const pathname ='));
  assert.equal(
    normalizationLine?.trim(),
    String.raw\`const pathname = request.nextUrl.pathname.replace(/\/+$/, '') || '/';\`,
  );

  const normalizePathname = (pathname) => pathname.replace(/\/+$/, '') || '/';
  assert.equal(normalizePathname('/login/'), '/login');
  assert.equal(normalizePathname('/login'), '/login');
  assert.equal(normalizePathname('/auth/callback/'), '/auth/callback');
  assert.equal(normalizePathname('/api/v1/health/'), '/api/v1/health');
  assert.equal(normalizePathname('/inventory/'), '/inventory');
  assert.equal(normalizePathname('/'), '/');
});

test('keeps login, auth, and API routes public after path normalization', () => {
  assert.match(proxySource, /const isLogin = pathname === '\/login' \|\| pathname\.startsWith\('\/auth\/'\)/);
  assert.match(proxySource, /const isApi = pathname\.startsWith\('\/api\/'\)/);
});

test('keeps protected routes behind the existing claims check', () => {
  assert.match(proxySource, /const isProtected = !isPublic/);
  assert.match(proxySource, /if \(error \|\| !claims\)/);
  assert.match(proxySource, /if \(isProtected\)/);
  assert.match(proxySource, /if \(isLogin\)/);
});
