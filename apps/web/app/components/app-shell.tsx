'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/', label: 'الرئيسية', icon: '⌂' },
  { href: '/stores/', label: 'المتاجر', icon: '▦' },
  { href: '/inventory/', label: 'المخزون', icon: '▤' },
  { href: '/capture/', label: 'تصوير الرفوف', icon: '▣' },
  { href: '/analysis/', label: 'تحليل الرف', icon: '⌁' },
  { href: '/review/', label: 'مراجعة التحليل', icon: '✓' },
  { href: '/reports/', label: 'التقارير والتصدير', icon: '▥' },
  { href: '/team/', label: 'إدارة الفريق', icon: '♙' },
];

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar" aria-label="القائمة الرئيسية">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">م</span>
          <span>
            <strong>مخزون ذكي</strong>
            <small>Inventory Intelligence</small>
          </span>
        </Link>

        <div className="workspace-label">مساحة العمل</div>
        <nav className="main-nav">
          {navigation.map((item) => {
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                className={active ? 'nav-link active' : 'nav-link'}
                href={item.href}
                key={item.href}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>نسخة تطويرية</span>
          <button type="button" className="signout-button" onClick={signOut}>تسجيل الخروج</button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">مساحة العمل</span>
            <strong>إدارة المتجر والمخزون</strong>
          </div>
          <div className="store-context" aria-label="حالة المتجر">
            <span className="store-avatar" aria-hidden="true">م</span>
            <span>
              <strong>لم يتم اختيار متجر</strong>
              <small>سيظهر المتجر بعد تفعيل الحسابات والصلاحيات</small>
            </span>
          </div>
        </header>

        <main className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">لوحة التحكم</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <span className="environment-tag">تطوير</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
