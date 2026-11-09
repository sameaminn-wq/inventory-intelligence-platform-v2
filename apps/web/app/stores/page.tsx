import { AppShell } from '../components/app-shell';
import { createClient } from '../../lib/supabase/server';
import { CreateStoreForm } from './create-store-form';

export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('stores')
    .select('id, name, slug, status, created_at').eq('status', 'active')
    .order('created_at', { ascending: false });
  const stores = data ?? [];

  return <AppShell title="المتاجر" description="أنشئ متجرك واعرض المتاجر التي يتيح حسابك الوصول إليها.">
    <section className="panel">
      <div className="section-head"><div><h2>متاجري</h2><p className="panel-subtitle">تُعرض المتاجر المسموح بها وفق صلاحيات قاعدة البيانات.</p></div><span className="team-count">{stores.length} متجر</span></div>
      {error ? <p className="error-message" role="alert">تعذر تحميل المتاجر. تحقق من إعدادات Supabase وتطبيق الترحيلات.</p> :
       stores.length===0 ? <div className="empty-state"><div className="empty-icon" aria-hidden="true">▦</div><h3>لا توجد متاجر مرتبطة بحسابك</h3><p>أنشئ متجرك الأول من النموذج أدناه.</p></div> :
       <div className="table-wrap"><table className="data-table team-table"><thead><tr><th>اسم المتجر</th><th>الرابط</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead><tbody>
        {stores.map(store=><tr key={store.id}><td><strong>{store.name}</strong></td><td dir="ltr">{store.slug}</td><td><span className="member-status active">نشط</span></td><td>{new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(store.created_at))}</td></tr>)}
       </tbody></table></div>}
    </section>
    <CreateStoreForm />
  </AppShell>;
}
