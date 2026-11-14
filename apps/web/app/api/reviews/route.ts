import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

async function context() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== 'string' || !userId) return null;
  return { supabase, userId };
}

export async function GET(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return fail('يجب تسجيل الدخول أولاً.', 401);
  const storeId = request.nextUrl.searchParams.get('storeId');
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) return fail('معرّف المتجر غير صالح.', 400);

  const { data, error } = await ctx.supabase.from('analysis_sessions')
    .select('id,store_id,created_by,capture_session_id,provider,model,status,review_required,result_json,created_at,reviewed_at')
    .eq('store_id', storeId).order('created_at', { ascending: false }).limit(50);
  if (error) return fail('تعذر تحميل جلسات التحليل المحفوظة.', 503);

  const sessions = data ?? [];
  const sessionsWithImages = await Promise.all(sessions.map(async session => {
    const result = session.result_json as Record<string, unknown>;
    const assets = Array.isArray(result.imageAssets) ? result.imageAssets : [];
    const imageUrls = await Promise.all(assets.map(async raw => {
      if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>).path !== 'string') return null;
      const asset = raw as { imageId?: string; path: string };
      const { data: signed, error: signedError } = await ctx.supabase.storage
        .from('shelf-captures').createSignedUrl(asset.path, 600);
      if (signedError || !signed) return null;
      return { imageId: asset.imageId ?? '', url: signed.signedUrl };
    }));
    return { ...session, imageUrls: imageUrls.filter(Boolean) };
  }));
  const ids = sessions.map(row => row.id);
  const reviewsResult = ids.length
    ? await ctx.supabase.from('analysis_reviews').select('id,analysis_session_id,reviewer_id,review_json,created_at').in('analysis_session_id', ids).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (reviewsResult.error) return fail('تعذر تحميل المراجعات المحفوظة.', 503);

  return NextResponse.json({ sessions: sessionsWithImages, reviews: reviewsResult.data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return fail('يجب تسجيل الدخول أولاً.', 401);
  let input: unknown;
  try { input = await request.json(); } catch { return fail('صيغة الطلب غير صالحة.', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('بيانات المراجعة غير صالحة.', 400);
  const body = input as Record<string, unknown>;
  if (typeof body.analysisSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.analysisSessionId) ||
      !Array.isArray(body.observations) || body.observations.length > 200) {
    return fail('معرّف جلسة التحليل أو الملاحظات غير صالح.', 400);
  }

  const { data: session, error: sessionError } = await ctx.supabase.from('analysis_sessions')
    .select('id,store_id,result_json').eq('id', body.analysisSessionId).maybeSingle();
  if (sessionError) return fail('تعذر التحقق من جلسة التحليل.', 503);
  if (!session) return fail('جلسة التحليل غير موجودة أو لا تملك صلاحية الوصول إليها.', 404);

  const source = session.result_json as Record<string, unknown>;
  const sourceObservations = Array.isArray(source.observations) ? source.observations : [];
  if (sourceObservations.length === 0) {
    return fail('لا توجد ملاحظات منتجات في هذه الجلسة لتسجيل مراجعتها.', 409);
  }
  if (body.observations.length !== sourceObservations.length) {
    return fail('يجب مراجعة كل ملاحظات الجلسة مرة واحدة، حتى لو تركت بعض الكميات غير معروفة.', 400);
  }

  const allowedIds = new Set(sourceObservations.flatMap(item =>
    item && typeof item === 'object' && typeof (item as Record<string, unknown>).detectionId === 'string'
      ? [(item as Record<string, unknown>).detectionId as string] : []
  ));
  if (allowedIds.size !== sourceObservations.length) {
    return fail('بيانات جلسة التحليل الأصلية تحتوي على معرّفات مكررة أو غير صالحة.', 409);
  }

  const seen = new Set<string>();
  for (const raw of body.observations) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('تحتوي المراجعة على ملاحظة غير صالحة.', 400);
    const row = raw as Record<string, unknown>;
    const quantityIsKnown = row.verifiedQuantity !== null &&
      Number.isInteger(row.verifiedQuantity) &&
      (row.verifiedQuantity as number) >= 0 &&
      (row.verifiedQuantity as number) <= 100000;
    if (typeof row.detectionId !== 'string' || !allowedIds.has(row.detectionId) || seen.has(row.detectionId) ||
        !(row.verifiedQuantity === null || quantityIsKnown) ||
        typeof row.accepted !== 'boolean' || row.accepted !== quantityIsKnown ||
        (row.note !== undefined && (typeof row.note !== 'string' || row.note.length > 500))) {
      return fail('تحتوي المراجعة على كمية أو معرّف غير صالح.', 400);
    }
    seen.add(row.detectionId);
  }
  if (seen.size !== allowedIds.size) {
    return fail('المراجعة لا تغطي جميع ملاحظات جلسة التحليل.', 400);
  }

  const reviewJson = {
    schemaVersion: 'human-review-1.0',
    observations: body.observations,
    note: 'هذه مراجعة بشرية موثقة؛ لا يتم تعديل رصيد المخزون تلقائياً.',
  };
  const { data: savedReviewData, error: saveError } = await ctx.supabase.rpc('save_analysis_review', {
    p_analysis_session_id: session.id,
    p_review_json: reviewJson,
  }).single();
  const savedReview = savedReviewData as { review_id: string; created_at: string } | null;
  if (saveError || !savedReview) {
    console.error('Atomic analysis review save failed:', saveError?.code);
    return fail('تعذر حفظ المراجعة وتحديث حالة الجلسة بشكل ذري.', 503);
  }
  return NextResponse.json({
    reviewId: savedReview.review_id,
    createdAt: savedReview.created_at,
  }, { status: 201 });
}
