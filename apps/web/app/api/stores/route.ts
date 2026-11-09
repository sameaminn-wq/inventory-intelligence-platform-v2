import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return error('إعدادات المصادقة غير مكتملة على الخادم.', 503);
  }

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || typeof userId !== 'string' || userId.length === 0) {
    return error('يجب تسجيل الدخول أولًا.', 401);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) {
    return error('تعذر تحميل عضويات المتاجر. تحقق من إعداد قاعدة البيانات.', 503);
  }
  if (!memberships?.length) return NextResponse.json({ stores: [] });

  const storeIds = [...new Set(memberships.map((membership) => membership.store_id))];
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, slug')
    .in('id', storeIds)
    .eq('status', 'active');

  if (storesError) return error('تعذر تحميل المتاجر المصرح بها.', 503);

  const roles = new Map(memberships.map((membership) => [membership.store_id, membership.role]));
  return NextResponse.json({
    stores: (stores ?? []).map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      role: roles.get(store.id) ?? null,
    })),
  });
}
