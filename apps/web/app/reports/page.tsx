import { AppShell } from '../components/app-shell';
export default function ReportsPage() {
  return <AppShell title="التقارير والتصدير" description="تقارير المخزون وحركاته ونتائج جرد الرفوف مع تصدير Excel عند ربط البيانات.">
    <div className="content-grid">
      <section className="panel"><h2>تقرير حالة المخزون</h2><p className="panel-subtitle">ملخص الأرصدة حسب المنتج ووحدة القياس.</p><div className="empty-state"><div className="empty-icon">▥</div><h3>لا توجد بيانات للتقرير</h3><p>اربط بيانات المتجر أولًا حتى لا نصدر تقريرًا فارغًا على أنه تقرير فعلي.</p></div></section>
      <section className="panel"><h2>تصدير Excel</h2><p className="panel-subtitle">سيتم تجهيز ملف من بيانات مصرح بها بعد تفعيل API والتقارير.</p><button className="secondary-button" disabled>التصدير غير متاح حاليًا</button><div className="notice">لم نضف مكتبات خارجية. سنستخدم إمكانات المشروع الحالية أو ننفذ صيغة تصدير مناسبة بعد تحديد عقد البيانات.</div></section>
    </div>
  </AppShell>;
}