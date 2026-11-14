import { redirect } from 'next/navigation';
import { AppShell } from './components/app-shell';
import { createClient } from '../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== 'string') redirect('/login/');

  const { data: memberships, error: membershipError } = await supabase
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) {
    return <AppShell title="تعذر تحميل مساحة العمل" description="لم نتمكن من التحقق من متاجرك. حاول مرة أخرى أو تواصل مع الدعم.">
      <section className="panel"><p className="error-message" role="alert">تعذر تحميل عضويات المتاجر. لم نعرض بيانات غير مؤكدة.</p></section>
    </AppShell>;
  }
  if (!memberships?.length) redirect('/stores/');

  const storeIds = [...new Set(memberships.map(item => item.store_id))];
  const [productsResult, sessionsResult] = await Promise.all([
    supabase.from('products').select('id,quantity_on_hand').in('store_id', storeIds),
    supabase.from('analysis_sessions').select('id,status').in('store_id', storeIds),
  ]);
  const dataError = productsResult.error || sessionsResult.error
    ? 'تعذر تحميل إحصاءات المخزون. تحقق من إعدادات Data API وصلاحيات Supabase.'
    : '';
  const products = productsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const stats = {
    products: products.length,
    units: products.reduce((sum, item) => sum + Number(item.quantity_on_hand ?? 0), 0),
    sessions: sessions.length,
    pending: sessions.filter(item => item.status === 'pending_review').length,
  };
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
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">⌁</div>
            <h3>لوحة المتجر متصلة</h3>
            <p>يمكنك متابعة المنتجات والأرصدة وجلسات التحليل والمراجعات من الاختصارات.</p>
          </div>
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
