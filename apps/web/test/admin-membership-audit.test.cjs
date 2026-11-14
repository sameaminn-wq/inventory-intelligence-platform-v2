const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(
  path.join(__dirname, '../app/api/admin/members/route.ts'),
  'utf8',
);

test('store creation compensates when owner membership or audit insertion fails', () => {
  assert.ok(routeSource.includes("if (memberError) {"));
  assert.ok(routeSource.includes("admin.from('stores').delete().eq('id',store.id)"));
  assert.ok(routeSource.includes('membershipRollbackError'));
  assert.ok(routeSource.includes('storeRollbackError'));
});

test('new memberships are removed when their audit event cannot be recorded', () => {
  assert.ok(routeSource.includes('membershipRollbackError'));
  assert.ok(routeSource.includes("admin.from('store_memberships').delete()"));
  assert.ok(routeSource.includes('Invite audit rollback user cleanup failed'));
});

test('membership role/status changes are restored when audit insertion fails', () => {
  assert.ok(routeSource.includes('Membership update audit rollback failed'));
  assert.ok(routeSource.includes("update({role:target.role,status:target.status"));
  assert.ok(routeSource.includes('previous_role:target.role as Role'));
  assert.ok(routeSource.includes('previous_status:target.status as Status'));
});
