import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
function fail(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== 'string' || !userId) return null;
  return supabase;
}

export async function GET(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase) return fail('يجب تسجيل الدخول أولاً.', 401);
  const storeId = new URL(request.url).searchParams.get('storeId');
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) return fail('معرّف المتجر غير صالح.', 400);

  const [productsResult, movementsResult] = await Promise.all([
    supabase.from('products').select('id,name,sku,unit,quantity_on_hand,minimum_quantity,created_at')
      .eq('store_id', storeId).order('name'),
    supabase.from('stock_movements').select('id,product_id,movement_type,quantity_delta,quantity_after,notes,created_at')
      .eq('store_id', storeId).order('created_at', { ascending: false }).limit(30),
  ]);
  if (productsResult.error || movementsResult.error) {
    return fail('تعذر تحميل بيانات المخزون. تأكد من تطبيق ترحيل المخزون.', 503);
  }
  return NextResponse.json({ products: productsResult.data ?? [], movements: movementsResult.data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase) return fail('يجب تسجيل الدخول أولاً.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('صيغة الطلب غير صالحة.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('بيانات المنتج غير صالحة.', 400);
  const input = body as Record<string, unknown>;
  if (typeof input.storeId !== 'string' || typeof input.name !== 'string' ||
      (input.sku !== undefined && input.sku !== null && typeof input.sku !== 'string') ||
      (input.unit !== undefined && typeof input.unit !== 'string') ||
      (input.minimumQuantity !== undefined && typeof input.minimumQuantity !== 'number')) {
    return fail('بيانات المنتج غير صالحة.', 400);
  }
  const { data, error } = await supabase.rpc('create_store_product', {
    p_store_id: input.storeId,
    p_name: input.name,
    p_sku: input.sku ?? null,
    p_unit: input.unit ?? 'piece',
    p_minimum_quantity: input.minimumQuantity ?? 0,
  });
  if (error) {
    if (error.code === '23505') return fail('رمز المنتج مستخدم بالفعل في هذا المتجر.', 409);
    if (error.code === '42501') return fail('تحتاج إلى صلاحية مدير أو مالك لإضافة المنتجات.', 403);
    if (error.code === '22023') return fail(error.message, 400);
    console.error('Product creation failed:', error.code);
    return fail('تعذر إنشاء المنتج حالياً.', 500);
  }
  return NextResponse.json({ productId: data }, { status: 201 });
}
