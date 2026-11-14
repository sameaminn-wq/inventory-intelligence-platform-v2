const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const signup = fs.readFileSync(path.join(__dirname, '../app/signup/page.tsx'), 'utf8');
const login = fs.readFileSync(path.join(__dirname, '../app/login/page.tsx'), 'utf8');
const proxy = fs.readFileSync(path.join(__dirname, '../lib/supabase/proxy.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
const stores = fs.readFileSync(path.join(__dirname, '../app/stores/create-store-form.tsx'), 'utf8');
const analyze = fs.readFileSync(path.join(__dirname, '../app/api/analyze/route.ts'), 'utf8');
const analysisPage = fs.readFileSync(path.join(__dirname, '../app/analysis/page.tsx'), 'utf8');

test('signup uses Supabase Auth and sends confirmation through the callback route', () => {
  assert.ok(signup.includes('supabase.auth.signUp'));
  assert.ok(signup.includes("window.location.origin + '/auth/callback'"));
  assert.ok(signup.includes('minLength={10}'));
  assert.ok(login.includes('supabase.auth.signInWithPassword'));
  assert.ok(login.includes('href="/signup/"'));
});

test('signup is public but protected pages still require verified claims', () => {
  assert.ok(proxy.includes("const isSignup = pathname === '/signup';"));
  assert.ok(proxy.includes('const isPublic = isLogin || isSignup || isAuthRoute;'));
  assert.ok(proxy.includes('if (error || !claims)'));
  assert.ok(proxy.includes('if (isLogin || isSignup)'));
});

test('new accounts without a store are sent to onboarding and existing members to dashboard', () => {
  assert.ok(dashboard.includes("if (!memberships?.length) redirect('/stores/')"));
  assert.ok(stores.includes("fetch('/api/stores'"));
  assert.ok(stores.includes("router.replace('/')"));
  assert.ok(stores.includes('create_store_for_current_user') === false);
});

test('every analysis attempt receives a unique private storage prefix', () => {
  assert.ok(analyze.includes('const analysisAttemptId = randomUUID();'));
  assert.ok(analyze.includes('${input.captureSessionId}/${analysisAttemptId}/${image.imageId}.jpg'));
  assert.ok(analyze.includes('async function cleanupUploadedAssets(paths: string[])'));
  assert.ok(analyze.includes('createAdminClient()'));
  assert.ok(analyze.includes('await cleanupUploadedAssets(imageAssets.map((asset) => asset.path));'));
});

test('human verification is centralized in the review workspace', () => {
  assert.ok(analysisPage.includes('href="/review/"'));
  assert.ok(!analysisPage.includes('saveHumanReview'));
});
