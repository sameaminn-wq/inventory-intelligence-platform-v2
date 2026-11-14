import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

export const runtime = 'nodejs';

const platformAdmins = () => new Set(
  (process.env.PLATFORM_ADMIN_USER_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);

const fail = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getClaims();
    const userId = authData?.claims?.sub;

    if (authError || typeof userId !== 'string' || !userId) {
      return fail('يجب تسجيل الدخول أولًا.', 401);
    }
    if (!platformAdmins().has(userId)) {
      return fail('هذه الصفحة متاحة لمسؤول المنصة فقط.', 403);
    }

    const admin = createAdminClient();
    const [{ data: stores, error: storesError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        admin.from('stores')
          .select('id,name,slug,status,created_at,created_by')
          .order('created_at', { ascending: false }),
        admin.from('store_memberships')
          .select('store_id,user_id,role,status'),
      ]);

    if (storesError || membershipsError) {
      console.error('Platform overview query failed:', storesError?.code, membershipsError?.code);
      return fail('تعذر تحميل بيانات لوحة المنصة.', 503);
    }

    const userIds = new Set((memberships ?? []).map((membership) => membership.user_id));
    const ownerIds = new Set((stores ?? []).map((store) => store.created_by).filter(Boolean));
    const userEmails = new Map<string, string>();

    // Email addresses are retrieved server-side and only the store creator's email is returned.
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error('Platform overview user lookup failed:', error.message);
        return fail('تعذر تحميل بيانات أصحاب المتاجر.', 503);
      }
      for (const user of data.users) {
        if (ownerIds.has(user.id) && user.email) userEmails.set(user.id, user.email);
      }
      if ([...ownerIds].every((id) => userEmails.has(id)) || data.users.length < 1000) break;
    }

    const membershipsByStore = new Map<string, { total: number; active: number; ownerId: string | null }>();
    for (const membership of memberships ?? []) {
      const current = membershipsByStore.get(membership.store_id) ?? {
        total: 0, active: 0, ownerId: null,
      };
      current.total += 1;
      if (membership.status === 'active') current.active += 1;
      if (membership.role === 'owner') current.ownerId = membership.user_id;
      membershipsByStore.set(membership.store_id, current);
    }

    const rows = (stores ?? []).map((store) => {
      const summary = membershipsByStore.get(store.id);
      const ownerId = summary?.ownerId ?? store.created_by ?? null;
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        createdAt: store.created_at,
        ownerEmail: ownerId ? userEmails.get(ownerId) ?? null : null,
        memberCount: summary?.total ?? 0,
        activeMemberCount: summary?.active ?? 0,
      };
    });

    const uniqueCustomers = new Set((memberships ?? []).map((membership) => membership.user_id));
    return NextResponse.json({
      stats: {
        stores: rows.length,
        activeStores: rows.filter((store) => store.status === 'active').length,
        suspendedStores: rows.filter((store) => store.status === 'suspended').length,
        customers: uniqueCustomers.size,
        memberships: (memberships ?? []).length,
      },
      stores: rows,
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return fail('حدث خطأ أثناء تحميل لوحة مسؤول المنصة.', 500);
  }
}
