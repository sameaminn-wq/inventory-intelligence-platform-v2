import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function csv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== 'string' || !userId) return fail('يجب تسجيل الدخول أولاً.', 401);

  const storeId = request.nextUrl.searchParams.get('storeId');
  const kind = request.nextUrl.searchParams.get('kind');
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId) || !['inventory','movements'].includes(kind ?? '')) {
    return fail('حدد المتجر ونوع التقرير بشكل صحيح.', 400);
  }

  let content: string;
  let filename: string;
  if (kind === 'inventory') {
    const { data, error } = await supabase.from('products')
      .select('name,sku,unit,quantity_on_hand,minimum_quantity,created_at')
      .eq('store_id', storeId).order('name');
    if (error) return fail('تعذر تجهيز تقرير المخزون.', 503);
    content = csv([
      ['اسم المنتج','رمز المنتج','الوحدة','الرصيد الحالي','حد التنبيه','تاريخ الإنشاء'],
      ...(data ?? []).map(p => [p.name,p.sku,p.unit,p.quantity_on_hand,p.minimum_quantity,p.created_at]),
    ]);
    filename = 'inventory-' + storeId.slice(0,8) + '.csv';
  } else {
    const { data, error } = await supabase.from('stock_movements')
      .select('product_id,movement_type,quantity_delta,quantity_after,notes,created_at')
      .eq('store_id', storeId).order('created_at',{ascending:false}).limit(10000);
    if (error) return fail('تعذر تجهيز تقرير حركات المخزون.', 503);
    content = csv([
      ['معرّف المنتج','نوع الحركة','التغير','الرصيد بعدها','ملاحظات','التاريخ'],
      ...(data ?? []).map(m => [m.product_id,m.movement_type,m.quantity_delta,m.quantity_after,m.notes,m.created_at]),
    ]);
    filename = 'stock-movements-' + storeId.slice(0,8) + '.csv';
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
