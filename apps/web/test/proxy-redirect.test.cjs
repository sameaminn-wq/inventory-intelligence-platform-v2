const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const proxySource = fs.readFileSync(
  path.join(__dirname, '../lib/supabase/proxy.ts'),
  'utf8',
);

test('normalizes trailing slashes before classifying routes', () => {
  assert.ok(proxySource.includes('function normalizePathname'));
  assert.ok(proxySource.includes('const pathname = normalizePathname(request.nextUrl.pathname)'));

  const normalizePathname = (pathname) =>
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  assert.equal(normalizePathname('/login/'), '/login');
  assert.equal(normalizePathname('/login'), '/login');
  assert.equal(normalizePathname('/auth/callback/'), '/auth/callback');
  assert.equal(normalizePathname('/api/v1/health/'), '/api/v1/health');
  assert.equal(normalizePathname('/inventory/'), '/inventory');
  assert.equal(normalizePathname('/'), '/');
});

test('keeps login and auth routes public while requiring claims for API routes', () => {
  assert.ok(proxySource.includes("const isLogin = pathname === '/login';"));
  assert.ok(proxySource.includes("const isSignup = pathname === '/signup';"));
  assert.ok(proxySource.includes("const isAuthRoute = isPathOrChild(pathname, '/auth');"));
  assert.ok(proxySource.includes('const isPublic = isLogin || isSignup || isAuthRoute;'));
  assert.ok(proxySource.includes('if (!isPublic)'));
});

test('keeps protected routes behind the claims check', () => {
  assert.ok(proxySource.includes('if (error || !claims)'));
  assert.ok(proxySource.includes('if (isLogin || isSignup)'));
});
