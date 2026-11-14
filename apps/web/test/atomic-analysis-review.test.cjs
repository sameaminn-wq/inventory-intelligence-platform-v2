const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const route = fs.readFileSync(path.join(__dirname, '../app/api/reviews/route.ts'), 'utf8');
const migration = fs.readFileSync(
  path.join(__dirname, '../../../supabase/migrations/20261114120000_atomic_analysis_review_save.sql'),
  'utf8',
);

test('review API uses one atomic database RPC instead of separate writes', () => {
  assert.ok(route.includes("ctx.supabase.rpc('save_analysis_review'"));
  assert.ok(!route.includes("from('analysis_reviews')\n    .insert("));
  assert.ok(!route.includes("from('analysis_sessions')\n    .update("));
});

test('atomic review RPC locks the session and commits review plus status together', () => {
  assert.match(migration, /for update;/i);
  assert.match(migration, /insert into public\.analysis_reviews/i);
  assert.match(migration, /update public\.analysis_sessions/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
});

test('atomic review RPC enforces complete source coverage and blocks direct status updates', () => {
  assert.match(migration, /Review must cover every source observation/);
  assert.match(migration, /unknown detection ID/);
  assert.match(migration, /v_existing_review_json = p_review_json/);
  assert.ok(migration.includes("set status = 'reviewed',\n          reviewed_at = v_existing_created_at"));
  assert.match(migration, /Analysis session already has a completed review/);
  assert.ok(route.includes("saveError?.code === '23505'"));
  assert.match(migration, /jsonb_typeof\(v_item -> 'accepted'\) is distinct from 'boolean'/i);
  assert.match(migration, /jsonb_typeof\(v_item -> 'detectionId'\) is distinct from 'string'/i);
  assert.match(migration, /revoke update \(status, reviewed_at\)/i);
  assert.match(migration, /drop policy if exists "active members can mark sessions reviewed"/i);
  assert.match(migration, /create unique index if not exists analysis_reviews_one_per_session_idx/i);
  assert.match(migration, /revoke insert on public\\.analysis_reviews from authenticated/i);
  assert.match(migration, /is distinct from 'human-review-1\\.0'/i);
});
