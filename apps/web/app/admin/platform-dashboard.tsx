'use client';

import { useCallback, useEffect, useState } from 'react';

type Stats = {
  stores: number;
  activeStores: number;
  suspendedStores: number;
  customers: number;
  memberships: number;
};
type Store = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  ownerEmail: string | null;
  memberCount: number;
  activeMemberCount: number;
};
type DashboardData = { stats: Stats; stores: Store[] };

const numberFormat = new Intl.NumberFormat('ar-EG');
const dateFormat = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' });

export function PlatformDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر تحميل لوحة المنصة.');
      setData(payload as DashboardData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = data ? [
    { label: 'إجمالي المتاجر', value: data.stats.stores, note: 'كل المتاجر المسجلة على المنصة' },
    { label: 'المتاجر النشطة', value: data.stats.activeStores, note: 'متاجر حالتها نشطة' },
    { label: 'المتاجر الموقوفة', value: data.stats.suspendedStores, note: 'متاجر حالتها موقوفة' },
    { label: 'العملاء', value: data.stats.customers, note: 'حسابات لها عضوية متجر واحدة أو أكثر' },
  ] : [];

  return (
    <>
      <div className="platform-admin-toolbar">
        <p>هذه البيانات للعرض فقط في هذه المرحلة؛ لا يتم تغيير حالة أي متجر من هذه اللوحة بعد.</p>
        <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'جارٍ التحديث…' : 'تحديث البيانات'}
        </button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {loading && !data ? <section className="panel">جارٍ تحميل بيانات المنصة…</section> : null}
      {data && (
        <>
          <section className="platform-stat-grid" aria-label="إحصاءات المنصة">
            {cards.map((card) => (
              <article className="stat-card" key={card.label}>
                <span className="stat-label">{card.label}</span>
                <strong className="platform-stat-value">{numberFormat.format(card.value)}</strong>
                <small className="stat-note">{card.note}</small>
              </article>
            ))}
          </section>
          <section className="panel platform-store-panel">
            <div className="section-head">
              <div>
                <h2>كل المتاجر</h2>
                <p className="panel-subtitle">قائمة مركزية للمتاجر وأصحابها وعدد الأعضاء.</p>
              </div>
              <span className="team-count">{numberFormat.format(data.stores.length)} متجر</span>
            </div>
            <div className="table-wrap">
              <table className="data-table platform-store-table">
                <thead><tr><th>المتجر</th><th>المالك</th><th>الأعضاء</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead>
                <tbody>
                  {data.stores.map((store) => (
                    <tr key={store.id}>
                      <td><strong>{store.name}</strong><small className="platform-store-slug" dir="ltr">{store.slug}</small></td>
                      <td>{store.ownerEmail ?? 'البريد غير متاح'}</td>
                      <td>{numberFormat.format(store.activeMemberCount)} نشط / {numberFormat.format(store.memberCount)} إجمالي</td>
                      <td><span className={'member-status ' + (store.status === 'active' ? 'active' : 'suspended')}>{store.status === 'active' ? 'نشط' : store.status === 'suspended' ? 'موقوف' : store.status}</span></td>
                      <td>{dateFormat.format(new Date(store.createdAt))}</td>
                    </tr>
                  ))}
                  {data.stores.length === 0 && <tr><td colSpan={5} className="table-empty">لا توجد متاجر مسجلة بعد.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
