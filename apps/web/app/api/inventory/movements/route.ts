import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (authError || typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'صيغة الطلب غير صالحة.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'بيانات الحركة غير صالحة.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (typeof input.storeId !== 'string' || typeof input.productId !== 'string' ||
      typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) ||
      !['inbound','outbound','adjustment'].includes(String(input.type)) ||
      (input.notes !== undefined && input.notes !== null && typeof input.notes !== 'string')) {
    return NextResponse.json({ error: 'بيانات الحركة غير صالحة.' }, { status: 400 });
  }
  const delta = input.type === 'outbound' ? -Math.abs(input.quantity) : input.quantity;
  const { data: quantityAfter, error } = await supabase.rpc('adjust_inventory_stock', {
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_quantity_delta: delta,
    p_movement_type: input.type,
    p_notes: input.notes ?? null,
  });
  if (error) {
    if (error.code === '42501') return NextResponse.json({ error: 'لا تملك صلاحية تعديل مخزون هذا المتجر.' }, { status: 403 });
    if (error.code === 'P0002') return NextResponse.json({ error: 'المنتج غير موجود في هذا المتجر.' }, { status: 404 });
    if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Stock movement failed:', error.code);
    return NextResponse.json({ error: 'تعذر تسجيل حركة المخزون.' }, { status: 500 });
  }
  return NextResponse.json({ quantityAfter });
}
