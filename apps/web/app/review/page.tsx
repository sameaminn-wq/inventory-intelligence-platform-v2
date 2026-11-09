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
  imageUrls?: Array<{ imageId: string; url: string }>;
};
type Review = {
  id: string;
  analysis_session_id: string;
  review_json: { observations?: Array<{ detectionId: string; verifiedQuantity: number | null; accepted: boolean; note?: string }> };
  created_at: string;
};

export default function ReviewPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (id: string) => {
    if (!id) { setSessions([]); setReviews([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/reviews?storeId=' + encodeURIComponent(id), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل المراجعات.');
      const loadedSessions = (data.sessions ?? []) as Session[];
      const loadedReviews = (data.reviews ?? []) as Review[];
      setSessions(loadedSessions);
      setReviews(loadedReviews);
      const next: Record<string, string> = {};
      for (const review of loadedReviews) {
        for (const item of review.review_json?.observations ?? []) {
          const key = review.analysis_session_id + ':' + item.detectionId;
          if (!(key in next)) next[key] = item.verifiedQuantity === null ? '' : String(item.verifiedQuantity);
        }
      }
      for (const session of loadedSessions) {
        for (const item of session.result_json?.observations ?? []) {
          const key = session.id + ':' + item.detectionId;
          if (!(key in next)) next[key] = item.estimatedVisibleQuantity === null ? '' : String(item.estimatedVisibleQuantity);
        }
      }
      setQuantities(next);
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

  async function saveReview(session: Session) {
    if (savingId) return;
    const observations = session.result_json?.observations ?? [];
    const values = observations.map(item => {
      const raw = quantities[session.id + ':' + item.detectionId] ?? '';
      return {
        detectionId: item.detectionId,
        verifiedQuantity: raw === '' ? null : Number(raw),
        accepted: raw !== '',
        note: '',
      };
    });
    if (values.some(item => item.verifiedQuantity !== null &&
      (!Number.isInteger(item.verifiedQuantity) || item.verifiedQuantity < 0 || item.verifiedQuantity > 100000))) {
      setError('يجب أن تكون الكمية التي تحققت منها عدداً صحيحاً بين صفر و100,000.');
      return;
    }
    setSavingId(session.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analysisSessionId: session.id, observations: values }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ المراجعة.');
      setNotice('تم حفظ المراجعة البشرية في قاعدة البيانات بنجاح.');
      await load(storeId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ المراجعة.');
    } finally { setSavingId(''); }
  }

  return <AppShell title="مراجعة تحليل الرفوف" description="راجع نتائج الذكاء الاصطناعي المحفوظة وأدخل الكميات التي تحققت منها بنفسك.">
    <section className="panel">
      <div className="section-head"><div><h2>جلسات التحليل</h2><p className="panel-subtitle">النتائج والصور والمراجعات محفوظة في قاعدة البيانات، ويمكن فتحها من جهاز آخر.</p></div><span className="team-count">{sessions.length} جلسة</span></div>
      {stores.length > 0 && <div className="store-picker"><label htmlFor="review-store">المتجر</label><select id="review-store" value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}</select></div>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="capture-feedback good" role="status">{notice}</p>}
      {loading ? <p className="panel-subtitle">جارٍ تحميل السجلات…</p> :
        sessions.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><h3>لا توجد جلسات محفوظة لهذا المتجر</h3><p>بعد تحليل الصور وحفظ النتائج، ستظهر هنا للمراجعة من أي جهاز مصرح به.</p><a className="primary-button" href="/capture/">بدء تصوير رف</a></div> :
        <div className="review-list">{sessions.map(session => {
          const observations = session.result_json?.observations ?? [];
          const sessionReviews = reviews.filter(r=>r.analysis_session_id===session.id);
          const latest = sessionReviews[0];
          const reviewedIds = new Set((latest?.review_json?.observations ?? []).filter(x=>x.accepted).map(x=>x.detectionId));
          return <article className="review-item" key={session.id}>
            <div className="section-head"><div><h3>جلسة {session.capture_session_id.slice(0,18)}</h3><p className="panel-subtitle">{new Date(session.created_at).toLocaleString('ar-EG')} · {session.provider} / {session.model}</p></div><span className={latest?'member-status active':'member-status invited'}>{latest?'لها مراجعة محفوظة':'بانتظار المراجعة'}</span></div>
            {session.result_json?.warnings?.length ? <div className="notice">{session.result_json.warnings.map((w,i)=><p key={i}>{w}</p>)}</div> : null}
            {session.imageUrls?.length ? <div className="review-list">{session.imageUrls.map(image=><figure key={image.imageId}><img className="review-source-image" src={image.url} alt="صورة رف محفوظة للجلسة" loading="lazy" /><figcaption className="panel-subtitle">{image.imageId}</figcaption></figure>)}</div> : null}
            <p className="panel-subtitle">{observations.length} ملاحظة منتج · {sessionReviews.length} مراجعة محفوظة</p>
            {observations.map(item=><div className="review-item" key={item.detectionId}>
              <div className="section-head"><div><strong>{item.candidateProductName || 'منتج غير محدد'}</strong><p className="panel-subtitle">{item.brand || 'علامة غير معروفة'} · {item.packageDescription || 'وصف العبوة غير متاح'}</p></div><span className="environment-tag">ثقة الهوية {(item.identityConfidence*100).toFixed(0)}%</span></div>
              <p>الكمية المرئية المقدرة: <b>{item.estimatedVisibleQuantity ?? 'غير معروفة'}</b></p>
              {item.reviewReasons?.length ? <p className="panel-subtitle">أسباب المراجعة: {item.reviewReasons.join('، ')}</p> : null}
              <label>الكمية التي تحققت منها فعلياً
                <input type="number" min="0" max="100000" step="1" value={quantities[session.id + ':' + item.detectionId] ?? ''} onChange={e=>setQuantities(current=>({...current,[session.id + ':' + item.detectionId]:e.target.value}))} placeholder="أدخل الكمية أو اتركها فارغة" />
              </label>
              <span className="panel-subtitle">{reviewedIds.has(item.detectionId)?'تم التحقق من هذه الملاحظة في آخر مراجعة':'لم يتم اعتماد كمية بشرية لهذه الملاحظة بعد'}</span>
            </div>)}
            {latest && <p className="capture-feedback good">آخر مراجعة محفوظة: {new Date(latest.created_at).toLocaleString('ar-EG')}</p>}
            {observations.length > 0 && <button className="primary-button" type="button" disabled={savingId===session.id || savingId!==''} onClick={()=>void saveReview(session)}>{savingId===session.id?'جارٍ حفظ المراجعة…':'حفظ المراجعة البشرية'}</button>}
          </article>;
        })}</div>}
    </section>
    <div className="notice">الكمية التي تتحقق منها منفصلة عن تقدير الذكاء الاصطناعي. حفظ المراجعة لا يغيّر رصيد المخزون تلقائياً؛ تعديل الرصيد يتطلب إجراءً مستقلاً وصلاحية مناسبة.</div>
  </AppShell>;
}
