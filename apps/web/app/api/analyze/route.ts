import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGES = 8;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_OBSERVATIONS = 200;
const MAX_WARNINGS = 50;
const MAX_REVIEW_REASONS = 20;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasImageSignature(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('إعدادات المصادقة غير مكتملة على الخادم.', 503);
  }
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || typeof userId !== 'string' || userId.length === 0) {
    return jsonError('يجب تسجيل الدخول قبل استخدام خدمة التحليل.', 401);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonError('حجم طلب التحليل أكبر من الحد المسموح. قلّل عدد الصور أو أعد التقاطها بجودة أقل.', 413);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError('تعذر قراءة بيانات جلسة التصوير.', 400);
  }
  if (!isRecord(input) || typeof input.captureSessionId !== 'string' ||
      input.captureSessionId.trim().length === 0 || input.captureSessionId.length > 128 ||
      !Array.isArray(input.images) || input.images.length < 1 || input.images.length > MAX_IMAGES) {
    return jsonError('جلسة التحليل غير مكتملة أو تحتوي على عدد صور غير صالح.', 400);
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  const images: Array<{ imageId: string; mimeType: string; dataBase64: string }> = [];
  for (const [index, raw] of input.images.entries()) {
    if (!isRecord(raw) || typeof raw.imageId !== 'string' || !raw.imageId.trim() ||
        raw.imageId.length > 128 || seen.has(raw.imageId) ||
        typeof raw.mimeType !== 'string' || !MIME_TYPES.has(raw.mimeType) ||
        typeof raw.dataBase64 !== 'string' || raw.dataBase64.length === 0 ||
        raw.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw.dataBase64) ||
        /=/.test(raw.dataBase64.slice(0, -2))) {
      return jsonError(`بيانات الصورة رقم ${index + 1} غير صالحة.`, 400);
    }
    seen.add(raw.imageId);
    const bytes = Buffer.from(raw.dataBase64, 'base64');
    if (bytes.length === 0 || bytes.toString('base64') !== raw.dataBase64 || !hasImageSignature(raw.mimeType, bytes)) {
      return jsonError(`تعذر التحقق من محتوى الصورة رقم ${index + 1}.`, 400);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_IMAGE_BYTES) return jsonError('إجمالي الصور أكبر من 20 ميجابايت.', 413);
    images.push({ imageId: raw.imageId, mimeType: raw.mimeType, dataBase64: raw.dataBase64 });
  }

  if (process.env.ANALYSIS_API_ENABLED !== 'true') {
    return jsonError('مسار التحليل غير مفعّل لهذه البيئة بعد.', 503);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) return jsonError('خدمة التحليل غير مهيأة بعد. أضف إعدادات مزود الذكاء الاصطناعي في Vercel.', 503);

  const prompt = [
    'Analyze these photographs as complementary views of ONE physical retail shelf.',
    'Do not count the same physical item twice across views.',
    'Only estimate quantities that are visibly supported. Use null for unknown or occluded quantities; never infer hidden stock.',
    'Separate product identity confidence from quantity estimation. Flag uncertainty and require human review.',
    'Return JSON only with this structure:',
    JSON.stringify({
      schemaVersion: '1.0',
      captureSessionId: input.captureSessionId,
      observations: [{
        detectionId: 'unique-id',
        sourceImageId: 'one-of-provided-image-ids',
        candidateProductName: 'string-or-null',
        brand: 'string-or-null',
        packageDescription: 'string-or-null',
        estimatedVisibleQuantity: 'integer-or-null',
        identityConfidence: 'number-0-to-1',
        boundingBox: { x: '0-to-1', y: '0-to-1', width: '0-to-1', height: '0-to-1' },
        reviewReasons: ['string'],
      }],
      crossViewMatches: [{
        matchGroupId: 'unique-id',
        detectionIds: ['detection-id-from-one-image', 'detection-id-from-another-image'],
        matchConfidence: 'number-0-to-1',
        rationale: 'string',
      }],
      unmatchedDetectionIds: ['detection-id'],
      warnings: ['string'],
      reviewRequired: true,
    }),
    'Bounding boxes are normalized to each source image. Do not invent barcodes, exact SKUs, or hidden quantities.',
    'Provided image IDs: ' + images.map((image) => image.imageId).join(', '),
  ].join('\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { text: prompt },
            ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.dataBase64 } })),
          ] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(55_000),
      },
    );
    if (!response.ok) {
      if (response.status === 429) return jsonError('مزود التحليل مشغول حاليًا. حاول مرة أخرى بعد قليل.', 503);
      return jsonError('تعذر إكمال تحليل الصور لدى مزود الذكاء الاصطناعي.', 502);
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.candidates)) return jsonError('استجابة التحليل غير صالحة.', 502);
    const first = payload.candidates[0];
    const parts = isRecord(first) && isRecord(first.content) && Array.isArray(first.content.parts) ? first.content.parts : [];
    const outputText = parts.map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '').join('');
    let result: unknown;
    try { result = JSON.parse(outputText); } catch { return jsonError('لم يرجع نموذج التحليل بيانات منظمة صالحة.', 502); }

    if (!isRecord(result) || result.schemaVersion !== '1.0' ||
        result.captureSessionId !== input.captureSessionId ||
        !Array.isArray(result.observations) || result.observations.length > MAX_OBSERVATIONS ||
        !Array.isArray(result.crossViewMatches) || result.crossViewMatches.length > MAX_OBSERVATIONS ||
        !Array.isArray(result.unmatchedDetectionIds) || result.unmatchedDetectionIds.length > MAX_OBSERVATIONS ||
        !Array.isArray(result.warnings) || result.warnings.length > MAX_WARNINGS ||
        typeof result.reviewRequired !== 'boolean' ||
        result.warnings.some((warning) => typeof warning !== 'string' || warning.length > 500)) {
      return jsonError('نتيجة التحليل لا تطابق العقد المتوقع.', 502);
    }
    const validImageIds = new Set(images.map((image) => image.imageId));
    const detectionIds = new Set<string>();
    for (const observation of result.observations) {
      if (!isRecord(observation) || typeof observation.detectionId !== 'string' ||
          observation.detectionId.length === 0 || observation.detectionId.length > 128 ||
          detectionIds.has(observation.detectionId) ||
          typeof observation.sourceImageId !== 'string' || !validImageIds.has(observation.sourceImageId) ||
          !(observation.candidateProductName === null || (typeof observation.candidateProductName === 'string' && observation.candidateProductName.length <= 300)) ||
          !(observation.brand === null || (typeof observation.brand === 'string' && observation.brand.length <= 200)) ||
          !(observation.packageDescription === null || (typeof observation.packageDescription === 'string' && observation.packageDescription.length <= 500)) ||
          !(observation.estimatedVisibleQuantity === null ||
            (Number.isInteger(observation.estimatedVisibleQuantity) && (observation.estimatedVisibleQuantity as number) >= 0 && (observation.estimatedVisibleQuantity as number) <= 100000)) ||
          typeof observation.identityConfidence !== 'number' || !Number.isFinite(observation.identityConfidence) ||
          observation.identityConfidence < 0 || observation.identityConfidence > 1 ||
          !Array.isArray(observation.reviewReasons) || observation.reviewReasons.length > MAX_REVIEW_REASONS ||
          observation.reviewReasons.some((reason) => typeof reason !== 'string' || reason.length > 300)) {
        return jsonError('تحتوي نتيجة التحليل على ملاحظة غير صالحة.', 502);
      }
      detectionIds.add(observation.detectionId);
      const box = observation.boundingBox;
      if (!isRecord(box) || !['x', 'y', 'width', 'height'].every((key) =>
        typeof box[key] === 'number' && Number.isFinite(box[key]) &&
        (box[key] as number) >= 0 && (box[key] as number) <= 1)) {
        return jsonError('تحتوي نتيجة التحليل على إطار تحديد غير صالح.', 502);
      }
    }
    const matchedIds = new Set<string>();
    for (const match of result.crossViewMatches) {
      if (!isRecord(match) || typeof match.matchGroupId !== 'string' ||
          typeof match.matchConfidence !== 'number' || !Number.isFinite(match.matchConfidence) ||
          match.matchConfidence < 0 || match.matchConfidence > 1 ||
          !Array.isArray(match.detectionIds) || match.detectionIds.length < 2 ||
          match.detectionIds.some((id) => typeof id !== 'string' || !detectionIds.has(id) || matchedIds.has(id))) {
        return jsonError('تحتوي نتيجة المطابقة بين الصور على مراجع غير صالحة.', 502);
      }
      for (const id of match.detectionIds as string[]) matchedIds.add(id);
    }
    if (result.unmatchedDetectionIds.some((id) => typeof id !== 'string' || !detectionIds.has(id) || matchedIds.has(id))) {
      return jsonError('تحتوي نتيجة التحليل على معرفات منتجات غير متسقة.', 502);
    }

    return NextResponse.json({
      ...result,
      provider: 'gemini',
      model,
      note: 'AI estimates are suggestions only. Human verification is required before any inventory update.',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') return jsonError('انتهت مهلة التحليل. جرّب عددًا أقل من الصور.', 504);
    return jsonError('حدث خطأ غير متوقع أثناء التحليل.', 502);
  }
}
