import { AppShell } from '../components/app-shell';
export default function InventoryPage() {
  return <AppShell title="إدارة المخزون" description="كتالوج المنتجات والأرصدة وحركات المخزون الخاصة بالمتجر المحدد.">
    <section className="panel"><div className="section-head"><div><h2>كتالوج المتجر</h2><p className="panel-subtitle">ستظهر المنتجات بعد ربط واجهة API والمصادقة وصلاحية الوصول إلى المتجر.</p></div><span className="environment-tag">غير متصل</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>المنتج</th><th>رمز المنتج</th><th>وحدة القياس</th><th>الرصيد الحالي</th><th>الحالة</th></tr></thead><tbody><tr><td colSpan={5} className="table-empty">لا توجد منتجات محمّلة. لم يتم إنشاء بيانات مخزون وهمية.</td></tr></tbody></table></div>
    </section>
    <section className="panel section-gap"><h2>حركات المخزون</h2><p className="panel-subtitle">كل تعديل مستقبلي سيُسجل كحركة مستقلة قابلة للمراجعة، ولن نعدّل سجل الحركات السابق.</p><div className="empty-state"><div className="empty-icon">↕</div><h3>لا توجد حركات متاحة</h3><p>يلزم ربط API وقاعدة البيانات قبل عرض الأرصدة أو تسجيل تعديلات.</p></div></section>
  </AppShell>;
}