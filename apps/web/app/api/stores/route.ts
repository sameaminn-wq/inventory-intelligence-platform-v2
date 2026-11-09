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


export async function POST(request: Request) {
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

  let body: unknown;
  try { body = await request.json(); }
  catch { return error('صيغة الطلب غير صالحة.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return error('بيانات المتجر غير صالحة.', 400);
  }
  const input = body as Record<string, unknown>;
  if (typeof input.name !== 'string' || typeof input.slug !== 'string' ||
      input.name.length > 160 || input.slug.length > 80) {
    return error('اسم المتجر أو رابطه غير صالح.', 400);
  }

  const { data: storeId, error: createError } = await supabase.rpc('create_store_for_current_user', {
    p_name: input.name, p_slug: input.slug,
  });
  if (createError) {
    if (createError.code === '23505') return error('رابط المتجر مستخدم بالفعل.', 409);
    if (createError.code === '22023') return error(createError.message, 400);
    console.error('Store creation failed:', createError.code);
    return error('تعذر إنشاء المتجر حالياً.', 500);
  }
  return NextResponse.json({ storeId }, { status: 201 });
}
