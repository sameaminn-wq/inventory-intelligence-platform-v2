'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../components/app-shell';

type Store = { id: string; name: string; slug: string; role: string };

export default function ReportsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل المتاجر.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function download(kind: 'inventory'|'movements') {
    if (!storeId || busy) return;
    setBusy(kind); setError(''); setNotice('');
    try {
      const response = await fetch('/api/reports?storeId=' + encodeURIComponent(storeId) + '&kind=' + kind, { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'تعذر تنزيل التقرير.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = kind === 'inventory' ? 'inventory-report.csv' : 'stock-movements-report.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(kind === 'inventory' ? 'تم تجهيز تقرير المخزون.' : 'تم تجهيز تقرير حركات المخزون.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنزيل التقرير.');
    } finally { setBusy(''); }
  }

  return <AppShell title="التقارير والتصدير" description="نزّل تقارير المخزون وحركاته بصيغة CSV المتوافقة مع Excel.">
    <section className="panel">
      <div className="section-head"><div><h2>تقارير المتجر</h2><p className="panel-subtitle">تُبنى التقارير من بيانات قاعدة البيانات التي يسمح RLS لحسابك بقراءتها.</p></div></div>
      {loading ? <p className="panel-subtitle">جارٍ تحميل المتاجر…</p> :
       stores.length === 0 ? <div className="empty-state"><h3>لا توجد متاجر مرتبطة بحسابك</h3><p>أنشئ متجراً أو اطلب إضافتك إلى متجر قبل تنزيل التقارير.</p><a className="primary-button" href="/stores/">إدارة المتاجر</a></div> :
       <>
        <div className="store-picker"><label htmlFor="report-store">المتجر</label><select id="report-store" value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}</select></div>
        <div className="content-grid">
          <article className="panel"><h3>تقرير حالة المخزون</h3><p className="panel-subtitle">المنتجات، رموزها، الوحدات، الأرصدة الحالية وحدود التنبيه.</p><button className="primary-button" disabled={!!busy || !storeId} onClick={()=>void download('inventory')}>{busy==='inventory'?'جارٍ التجهيز…':'تنزيل تقرير المخزون CSV'}</button></article>
          <article className="panel"><h3>تقرير حركات المخزون</h3><p className="panel-subtitle">الوارد والصادر والتسويات مع الرصيد بعد كل حركة، حتى 10,000 حركة.</p><button className="primary-button" disabled={!!busy || !storeId} onClick={()=>void download('movements')}>{busy==='movements'?'جارٍ التجهيز…':'تنزيل تقرير الحركات CSV'}</button></article>
        </div>
       </>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="capture-feedback good" role="status">{notice}</p>}
    </section>
    <div className="notice">ملفات CSV تُفتح مباشرة في Excel. تم تحييد القيم النصية التي قد تُفسر كصيغ عند فتح الملف لحماية المستخدم من CSV injection.</div>
  </AppShell>;
}
