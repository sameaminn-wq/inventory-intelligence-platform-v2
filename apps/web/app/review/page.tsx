import { AppShell } from '../components/app-shell';
export default function ReviewPage() {
  return <AppShell title="مراجعة تحليل الرفوف" description="راجع اقتراحات التعرف على المنتجات والكميات قبل اعتماد أي تغيير في المخزون.">
    <section className="panel"><div className="section-head"><div><h2>قائمة المراجعات</h2><p className="panel-subtitle">لا يتم اعتماد اقتراحات الذكاء الاصطناعي تلقائيًا.</p></div><span className="environment-tag">بانتظار الربط</span></div>
      <div className="empty-state"><div className="empty-icon">✓</div><h3>لا توجد جلسات مراجعة محمّلة</h3><p>ستظهر هنا الصور والمنتجات المرشحة ومربعات التحديد ودرجة الثقة وأسباب المراجعة بعد ربط خدمة التحليل وتخزين الجلسات.</p></div>
    </section>
    <div className="notice">قاعدة اعتماد: الكمية الظاهرة منفصلة عن الكمية المقدرة والكمية التي تم التحقق منها. المنتجات المحجوبة لا تتحول إلى كمية مؤكدة بالتخمين.</div>
  </AppShell>;
}