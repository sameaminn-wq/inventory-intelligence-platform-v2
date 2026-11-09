import { AppShell } from './components/app-shell';

const stats = [
  { label: 'المنتجات المسجلة', value: '—', note: 'بانتظار ربط كتالوج المتجر' },
  { label: 'إجمالي وحدات المخزون', value: '—', note: 'لا توجد بيانات مخزون متصلة' },
  { label: 'جلسات التصوير', value: '—', note: 'ستظهر بعد تفعيل واجهة الالتقاط' },
  { label: 'مراجعات معلّقة', value: '—', note: 'لا توجد نتائج مراجعة محمّلة' },
];

export default function HomePage() {
  return (
    <AppShell title="نظرة عامة" description="تابع حالة المخزون وجلسات تصوير الأرفف ومراجعات التحليل من مكان واحد.">
      <section className="stat-grid" aria-label="ملخص المتجر">
        {stats.map((item) => (
          <article className="stat-card" key={item.label}>
            <span className="stat-label">{item.label}</span>
            <strong className="stat-value">{item.value}</strong>
            <small className="stat-note">{item.note}</small>
          </article>
        ))}
      </section>
      <div className="content-grid">
        <section className="panel">
          <h2>حالة العمل</h2>
          <p className="panel-subtitle">ملخص اتصال الواجهة بمصادر بيانات المتجر.</p>
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">⌁</div>
            <h3>لم يتم ربط متجر بعد</h3>
            <p>هذه الواجهة لا تعرض أرقامًا تجريبية على أنها بيانات حقيقية. ستظهر المنتجات والأرصدة بعد اكتمال المصادقة وربط API المتجر.</p>
          </div>
        </section>
        <section className="panel">
          <h2>اختصارات العمل</h2>
          <p className="panel-subtitle">انتقل إلى المهمة المطلوبة.</p>
          <div className="action-list">
            <a className="action-row" href="/inventory/"><span>▤</span><div><strong>إدارة المخزون</strong><small>عرض المنتجات والأرصدة والحركات</small></div></a>
            <a className="action-row" href="/capture/"><span>▣</span><div><strong>تصوير رف جديد</strong><small>التقاط صور الرف وفحص جودتها</small></div></a>
            <a className="action-row" href="/review/"><span>✓</span><div><strong>مراجعة التحليل</strong><small>فحص اقتراحات الذكاء الاصطناعي</small></div></a>
            <a className="action-row" href="/reports/"><span>▥</span><div><strong>التقارير والتصدير</strong><small>مراجعة التقارير وتجهيز التصدير</small></div></a>
          </div>
        </section>
      </div>
      <div className="notice">تنبيه: نسخة التطوير لا تحتوي بعد على بيانات متاجر حقيقية أو صلاحيات مستخدمين مفعّلة.</div>
    </AppShell>
  );
}
