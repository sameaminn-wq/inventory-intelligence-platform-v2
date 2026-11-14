'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { loadLatestCaptureSession } from '../../lib/capture-session-store';

type Frame = { id: string; dataUrl: string; mimeType?: string };
type Session = { captureSessionId: string; frames: Frame[] };
type StoreOption = { id: string; name: string; slug: string; role: string };
type Observation = {
  detectionId: string;
  sourceImageId: string;
  candidateProductName: string | null;
  brand: string | null;
  packageDescription: string | null;
  estimatedVisibleQuantity: number | null;
  identityConfidence: number;
  reviewReasons: string[];
};
type Analysis = {
  analysisSessionId: string;
  captureSessionId: string;
  storeId: string;
  provider: string;
  model: string;
  observations: Observation[];
  warnings: string[];
  reviewRequired: boolean;
  note: string;
};

const ANALYSIS_KEY = 'inventory.analysis-result.v1';
const MAX_UPLOAD_BYTES = 2.8 * 1024 * 1024;

async function compressForVercel(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('تعذر تجهيز إحدى الصور للإرسال.'));
  });
  const scale = Math.min(1, 1280 / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('المتصفح لا يستطيع ضغط الصورة.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.62).split(',')[1] ?? '';
}

export default function AnalysisPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storesLoading, setStoresLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function restoreLocalData() {
      try {
        const storesResponse = await fetch('/api/stores', { cache: 'no-store' });
        const storesPayload = await storesResponse.json();
        if (!storesResponse.ok) throw new Error(storesPayload.error || 'تعذر تحميل المتاجر.');
        if (active) {
          const availableStores = Array.isArray(storesPayload.stores) ? storesPayload.stores as StoreOption[] : [];
          setStores(availableStores);
          if (availableStores.length === 1) setSelectedStoreId(availableStores[0].id);
        }
        setStoresLoading(false);
        const storedSession = await loadLatestCaptureSession();
        if (!active) return;
        if (storedSession) {
          setSession(storedSession);
          setPreviewImages(Object.fromEntries(storedSession.frames.map((frame) => [frame.id, frame.dataUrl])));
        }
        const rawAnalysis = window.sessionStorage.getItem(ANALYSIS_KEY);
        if (rawAnalysis) {
          const parsed = JSON.parse(rawAnalysis) as Analysis;
          const storeStillAuthorized = typeof parsed.storeId === 'string' &&
            (storesPayload.stores as StoreOption[]).some((store) => store.id === parsed.storeId);
          if (storeStillAuthorized) {
            setAnalysis(parsed);
            setSelectedStoreId(parsed.storeId);
              item.detectionId,
              item.estimatedVisibleQuantity === null ? '' : String(item.estimatedVisibleQuantity),
            ])));
          } else {
            window.sessionStorage.removeItem(ANALYSIS_KEY);
          }
        }
      } catch (cause) {
        if (active) {
          setStoresLoading(false);
          setError(cause instanceof Error ? cause.message : 'تعذر استعادة جلسة التصوير أو تحميل المتاجر.');
        }
      }
    }
    void restoreLocalData();
    return () => { active = false; };
  }, []);

  const imageCount = session?.frames.length ?? 0;
  const estimatedPayloadBytes = useMemo(
    () => session?.frames.reduce((sum, frame) => sum + Math.floor(((frame.dataUrl.split(',')[1] ?? '').length * 3) / 4), 0) ?? 0,
    [session],
  );

  async function runAnalysis() {
    if (!session || session.frames.length === 0 || busy) return;
    if (!selectedStoreId) {
      setError('اختر المتجر الذي التقطت له الصور قبل بدء التحليل.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const images = [];
      let totalBytes = 0;
      for (const frame of session.frames) {
        const dataBase64 = await compressForVercel(frame.dataUrl);
        totalBytes += Math.floor((dataBase64.length * 3) / 4);
        if (totalBytes > MAX_UPLOAD_BYTES) {
          throw new Error('حجم الصور بعد الضغط ما زال أكبر من 2.8 ميجابايت. ابدأ جلسة بعدد صور أقل أو التقط صورًا أقل حجمًا.');
        }
        images.push({ imageId: frame.id, mimeType: 'image/jpeg', dataBase64 });
      }
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ captureSessionId: session.captureSessionId, storeId: selectedStoreId, images }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'فشل تحليل الصور.');
      const parsed = payload as Analysis;
      setAnalysis(parsed);
        item.detectionId,
        item.estimatedVisibleQuantity === null ? '' : String(item.estimatedVisibleQuantity),
      ])));
      window.sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(parsed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حدث خطأ أثناء تحليل الصور.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <AppShell title="تحليل الرف" description="حلّل صور الجلسة على خادم Vercel، ثم راجع اقتراحات الذكاء الاصطناعي قبل أي اعتماد.">
      <section className="panel">
        <div className="section-head">
          <div><h2>جلسة التصوير</h2><p className="panel-subtitle">{session ? session.captureSessionId : 'لا توجد جلسة مستعادة'}</p></div>
          <span className="environment-tag">{imageCount} صور</span>
        </div>
        {!storesLoading && stores.length === 0 && <div className="notice">حسابك لا يرتبط حاليًا بأي متجر نشط. اطلب من مدير النظام إضافتك إلى متجر قبل إجراء التحليل.</div>}
        {stores.length > 0 && <div className="store-picker">
          <label htmlFor="analysis-store">المتجر الذي تنتمي إليه الصور</label>
          <select id="analysis-store" value={selectedStoreId} onChange={(event) => {
            setSelectedStoreId(event.target.value);
            setAnalysis(null);
            window.sessionStorage.removeItem(ANALYSIS_KEY);
          }}>
            <option value="">اختر متجرًا</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name} — {store.role}</option>)}
          </select>
        </div>}
        {!session && <div className="empty-state"><h3>لا توجد جلسة جاهزة للتحليل</h3><p>ارجع إلى صفحة التصوير والتقط صورة واسعة وصور الأجزاء المطلوبة.</p><a className="primary-button" href="/capture/">العودة للتصوير</a></div>}
        {session && <div className="capture-session-actions">
          <button className="primary-button" type="button" onClick={runAnalysis} disabled={busy || imageCount === 0 || !selectedStoreId || stores.length === 0}>{busy ? 'جارٍ ضغط الصور وتحليلها…' : analysis ? 'إعادة التحليل' : 'بدء تحليل الصور'}</button>
          <span className="panel-subtitle">حجم الصور الأصلي التقريبي: {(estimatedPayloadBytes / (1024 * 1024)).toFixed(2)} ميجابايت. يتم ضغطها داخل المتصفح قبل الإرسال.</span>
        </div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {busy && <p className="notice" role="status">يتم تجهيز الصور وإرسالها إلى API على Vercel. لا تغلق الصفحة أثناء التحليل.</p>}
      </section>

      {analysis && <section className="panel">
        <div className="section-head"><div><h2>نتائج التحليل</h2><p className="panel-subtitle">المزود: {analysis.provider} · النموذج: {analysis.model}</p></div><span className="environment-tag">تتطلب مراجعة بشرية</span></div>
        {analysis.warnings.length > 0 && <div className="notice"><strong>تنبيهات التحليل</strong><ul>{analysis.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
        {analysis.observations.length === 0 && <div className="empty-state"><h3>لم يتم العثور على ملاحظات منتجات مؤكدة</h3><p>جرّب صورًا أوضح أو زوايا إضافية. عدم ظهور منتج لا يعني أن الرف خالٍ منه.</p></div>}
        <div className="review-list">
          {analysis.observations.map((item) => (
            <article className="review-item" key={item.detectionId}>
              <div className="section-head">
                <div><h3>{item.candidateProductName || 'منتج غير محدد'}</h3><p className="panel-subtitle">{item.brand || 'علامة تجارية غير محددة'} · الصورة: {item.sourceImageId}</p></div>
                <span className="environment-tag">ثقة الهوية {(item.identityConfidence * 100).toFixed(0)}%</span>
              </div>
              {previewImages[item.sourceImageId] && <img className="review-source-image" src={previewImages[item.sourceImageId]} alt="الصورة الأصلية التي استُخرجت منها الملاحظة" loading="lazy" />}
              {item.packageDescription && <p>{item.packageDescription}</p>}
              <div className="metric-list">
                <span>الكمية المرئية المقدرة بواسطة AI: <b>{item.estimatedVisibleQuantity === null ? 'غير معروفة' : item.estimatedVisibleQuantity}</b></span>
                <label>الكمية المرئية التي تحققت منها
                </label>
              </div>
              {item.reviewReasons.length > 0 && <p className="notice">أسباب المراجعة: {item.reviewReasons.join('، ')}</p>}
            </article>
          ))}
        </div>
        {analysis.observations.length > 0 && <div className="capture-session-actions">
          <a className="primary-button" href="/review/">الانتقال إلى المراجعة البشرية</a>
        </div>}
        <div className="notice">{analysis.note} لا يتم تحديث المخزون من هذه الصفحة؛ الكميات المرئية المقدرة منفصلة عن الكميات التي تحقق منها الموظف.</div>
      </section>}
    </AppShell>
  );
}
