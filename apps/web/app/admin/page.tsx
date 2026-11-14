import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { PlatformDashboard } from './platform-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== 'string' || !userId) redirect('/login/');
  const platformAdmins = new Set(
    (process.env.PLATFORM_ADMIN_USER_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  );
  if (!platformAdmins.has(userId)) redirect('/');

  return (
    <main className="platform-admin" dir="rtl">
      <header className="platform-admin-header">
        <div>
          <span className="eyebrow">إدارة المنصة</span>
          <h1>لوحة مسؤول المنصة</h1>
          <p>نظرة شاملة على المتاجر والعملاء وحالة الحسابات.</p>
        </div>
        <Link className="secondary-button" href="/team/">العودة إلى مساحة العمل</Link>
      </header>
      <PlatformDashboard />
    </main>
  );
}
