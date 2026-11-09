'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const supabase = createClient();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const requested = searchParams.get('next') || '/';
        const safePath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
        router.replace(safePath);
        router.refresh();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (data.session) {
          router.replace('/');
          router.refresh();
        } else {
          setMessage('تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده قبل تسجيل الدخول.');
        }
      }
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
        <h1>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h1>
        <p>ادخل إلى مساحة العمل لإدارة تصوير الأرفف ومراجعة التحليل.</p>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>تسجيل الدخول</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>حساب جديد</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">البريد الإلكتروني</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="auth-password">كلمة المرور</label>
          <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'جارٍ التنفيذ…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <p className="auth-footnote">إنشاء الحساب لا يمنح صلاحية الوصول إلى متجر تلقائيًا. يجب أن يضيف مدير المتجر عضويتك وصلاحياتك أولًا.</p>
      </section>
    </main>
  );
}
