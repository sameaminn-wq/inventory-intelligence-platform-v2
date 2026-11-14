import { AppShell } from '../components/app-shell';
import { createClient } from '../../lib/supabase/server';
import { InventoryWorkspace } from './inventory-workspace';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id,name,slug')
    .eq('status','active')
    .order('name');

  const availableStores = stores ?? [];
  return <AppShell title="إدارة المخزون" description="أدر كتالوج المنتجات والأرصدة وحركات المخزون لكل متجر.">
    {error ? <section className="panel"><p className="error-message">تعذر تحميل المتاجر المصرح بها. تحقق من صلاحيات Supabase.</p></section> :
      <InventoryWorkspace stores={availableStores} initialStoreId={availableStores[0]?.id ?? ''} />}
  </AppShell>;
}
