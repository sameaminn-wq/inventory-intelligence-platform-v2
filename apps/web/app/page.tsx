import { AppShell } from './components/app-shell';
import { createClient } from '../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  let stats = { products: 0, units: 0, sessions: 0, pending: 0 };
  let dataError = '';

  if (typeof userId === 'string') {
    const { data: memberships, error: membershipError } = await supabase
      .from('store_memberships').select('store_id')
      .eq('user_id', userId).eq('status', 'active');
    if (membershipError) dataError = 'تعذر تحميل عضويات المتاجر.';
    else {
      const storeIds = [...new Set((memberships ?? []).map(x => x.store_id))];
      if (storeIds.length) {
        const [productsResult, sessionsResult] = await Promise.all([
          supabase.from('products').select('id,quantity_on_hand').in('store_id', storeIds),
          supabase.from('analysis_sessions').select('id,status').in('store_id', storeIds),
        ]);
        if (productsResult.error || sessionsResult.error) {
          dataError = 'تعذر تحميل إحصاءات المخزون. تحقق من إعدادات Data API وصلاحيات Supabase.';
        } else {
          const products = productsResult.data ?? [];
          const sessions = sessionsResult.data ?? [];
          stats = {
            products: products.length,
            units: products.reduce((sum, item) => sum + Number(item.quantity_on_hand ?? 0), 0),
            sessions: sessions.length,
            pending: sessions.filter(item => item.status === 'pending_review').length,
          };
        }
      }
    }
  }

  const cards = [
    { label: 'المنتجات المسجلة', value: stats.products.toLocaleString('ar-EG'), note: 'منتجات في المتاجر التي تملك صلاحية الوصول إليها' },
    { label: 'إجمالي وحدات المخزون', value: stats.units.toLocaleString('ar-EG'), note: 'مجموع الأرصدة الحالية للمنتجات' },
    { label: 'جلسات التحليل', value: stats.sessions.toLocaleString('ar-EG'), note: 'جلسات محفوظة في قاعدة البيانات' },
    { label: 'مراجعات معلّقة', value: stats.pending.toLocaleString('ar-EG'), note: 'جلسات تنتظر مراجعة بشرية' },
  ];

  return (
    <AppShell title="نظرة عامة" description="تابع حالة المخزون وجلسات تصوير الأرفف ومراجعات التحليل من مكان واحد.">
      <section className="stat-grid" aria-label="ملخص المتجر">
        {cards.map(item => <article className="stat-card" key={item.label}>
          <span className="stat-label">{item.label}</span>
          <strong className="stat-value">{item.value}</strong>
          <small className="stat-note">{item.note}</small>
        </article>)}
      </section>
      {dataError && <div className="notice" role="status">{dataError}</div>}
      <div className="content-grid">
        <section className="panel">
          <h2>حالة العمل</h2>
          <p className="panel-subtitle">الإحصاءات أعلاه مأخوذة مباشرة من قاعدة البيانات وبحسب صلاحيات حسابك.</p>
          {userId ? <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">⌁</div>
            <h3>لوحة المتجر متصلة</h3>
            <p>يمكنك متابعة المنتجات والأرصدة وجلسات التحليل والمراجعات من الاختصارات.</p>
          </div> : <div className="empty-state"><h3>سجّل الدخول للمتابعة</h3><a className="primary-button" href="/login/">تسجيل الدخول</a></div>}
        </section>
        <section className="panel">
          <h2>اختصارات العمل</h2>
          <p className="panel-subtitle">انتقل إلى المهمة المطلوبة.</p>
          <div className="action-list">
            <a className="action-row" href="/stores/"><span>▦</span><div><strong>إدارة المتاجر</strong><small>إنشاء المتاجر وإدارة الوصول</small></div></a>
            <a className="action-row" href="/inventory/"><span>▤</span><div><strong>إدارة المخزون</strong><small>عرض المنتجات والأرصدة والحركات</small></div></a>
            <a className="action-row" href="/capture/"><span>▣</span><div><strong>تصوير رف جديد</strong><small>التقاط صور الرف وفحص جودتها</small></div></a>
            <a className="action-row" href="/review/"><span>✓</span><div><strong>مراجعة التحليل</strong><small>مراجعة النتائج المحفوظة وتوثيق الكميات</small></div></a>
            <a className="action-row" href="/reports/"><span>▥</span><div><strong>التقارير والتصدير</strong><small>مراجعة تقارير المخزون</small></div></a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
