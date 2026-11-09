'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/app-shell';

type Store = { id: string; name: string; slug: string; role: string };
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
type Session = {
  id: string;
  capture_session_id: string;
  provider: string;
  model: string;
  status: string;
  result_json: { observations?: Observation[]; warnings?: string[] };
  created_at: string;
};
type Review = { id: string; analysis_session_id: string; review_json: { observations?: Array<{ detectionId: string; verifiedQuantity: number | null; accepted: boolean; note?: string }> }; created_at: string };

export default function ReviewPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (id: string) => {
    if (!id) { setSessions([]); setReviews([]); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/reviews?storeId=' + encodeURIComponent(id), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل المراجعات.');
      setSessions(data.sessions ?? []);
      setReviews(data.reviews ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المراجعات.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/stores', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'تعذر تحميل المتاجر.');
        if (!active) return;
        const available = (data.stores ?? []) as Store[];
        setStores(available);
        if (available[0]) setStoreId(available[0].id);
        else setLoading(false);
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل المتاجر.'); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (storeId) void load(storeId); }, [storeId, load]);

  return <AppShell title="مراجعة تحليل الرفوف" description="راجع نتائج الذكاء الاصطناعي المحفوظة وأثر التحقق البشري لكل متجر.">
    <section className="panel">
      <div className="section-head"><div><h2>جلسات التحليل</h2><p className="panel-subtitle">تُحفظ النتائج والمراجعات في قاعدة البيانات وتظل مرتبطة بالمتجر.</p></div><span className="team-count">{sessions.length} جلسة</span></div>
      {stores.length > 0 && <div className="store-picker"><label htmlFor="review-store">المتجر</label><select id="review-store" value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}</select></div>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {loading ? <p className="panel-subtitle">جارٍ تحميل السجلات…</p> :
        sessions.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><h3>لا توجد جلسات محفوظة لهذا المتجر</h3><p>بعد تحليل الصور وحفظ النتائج، ستظهر هنا للمراجعة من أي جهاز مصرح به.</p><a className="primary-button" href="/capture/">بدء تصوير رف</a></div> :
        <div className="review-list">{sessions.map(session => {
          const observations = session.result_json?.observations ?? [];
          const sessionReviews = reviews.filter(r=>r.analysis_session_id===session.id);
          const latest = sessionReviews[0];
          const reviewedIds = new Set((latest?.review_json?.observations ?? []).map(x=>x.detectionId));
          return <article className="review-item" key={session.id}>
            <div className="section-head"><div><h3>جلسة {session.capture_session_id.slice(0,18)}</h3><p className="panel-subtitle">{new Date(session.created_at).toLocaleString('ar-EG')} · {session.provider} / {session.model}</p></div><span className={latest?'member-status active':'member-status invited'}>{latest?'لها مراجعة محفوظة':'بانتظار المراجعة'}</span></div>
            {session.result_json?.warnings?.length ? <div className="notice">{session.result_json.warnings.map((w,i)=><p key={i}>{w}</p>)}</div> : null}
            {session.imageUrls?.length ? <div className="review-list">{session.imageUrls.map(image=><figure key={image.imageId}><img className="review-source-image" src={image.url} alt="صورة رف محفوظة للجلسة" loading="lazy" /><figcaption className="panel-subtitle">{image.imageId}</figcaption></figure>)}</div> : null}
            <p className="panel-subtitle">{observations.length} ملاحظة منتج · {sessionReviews.length} مراجعة محفوظة</p>
            {observations.map(item=><div className="metric-list" key={item.detectionId}>
              <span><b>{item.candidateProductName || 'منتج غير محدد'}</b> — {item.brand || 'علامة غير معروفة'}</span>
              <span>الكمية المقدرة: {item.estimatedVisibleQuantity ?? 'غير معروفة'} · ثقة الهوية: {(item.identityConfidence*100).toFixed(0)}%</span>
              <span>{reviewedIds.has(item.detectionId)?'تمت مراجعته في آخر مراجعة':'لم تتم مراجعته بعد'}</span>
            </div>)}
            {latest && <p className="capture-feedback good">آخر مراجعة محفوظة: {new Date(latest.created_at).toLocaleString('ar-EG')}</p>}
            <a className="secondary-button" href="/analysis/">فتح صفحة التحليل والمراجعة</a>
          </article>;
        })}</div>}
    </section>
    <div className="notice">المراجعة تحفظ الكمية التي تحقق منها المستخدم ولا تغيّر رصيد المخزون تلقائياً. اعتمادها كتغيير مخزون يحتاج خطوة منفصلة بصلاحية مناسبة.</div>
  </AppShell>;
}
