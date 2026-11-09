'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const requested = searchParams.get('next') || '/';
      const safePath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
      router.replace(safePath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إكمال تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-brand">Inventory Intelligence</div>
        <h1>تسجيل الدخول</h1>
        <p>استخدم بيانات الحساب التي أنشأها مدير النظام للوصول إلى مساحة العمل.</p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">البريد الإلكتروني</label>
          <input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="auth-password">كلمة المرور</label>
          <input id="auth-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'جارٍ تسجيل الدخول…' : 'دخول'}</button>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        <p className="auth-footnote">إنشاء الحسابات وإسنادها للمتاجر يتم إداريًا. تسجيل الدخول وحده لا يمنح صلاحية الوصول إلى بيانات أي متجر.</p>
      </section>
    </main>
  );
}
