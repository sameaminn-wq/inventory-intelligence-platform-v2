'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 10) {
      setError('استخدم كلمة مرور لا تقل عن 10 أحرف.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + '/auth/callback' },
      });
      if (signupError) throw signupError;

      if (data.session) {
        router.replace('/');
        router.refresh();
        return;
      }
      setMessage('تم إنشاء طلب الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد، ثم ارجع إلى هنا وسجّل الدخول.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب حالياً.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-brand">Inventory Intelligence</div>
        <h1>إنشاء حساب جديد</h1>
        <p>أنشئ حسابك، ثم أنشئ متجرك الأول وابدأ إدارة المخزون.</p>
        <form onSubmit={submit}>
          <label htmlFor="signup-email">البريد الإلكتروني</label>
          <input id="signup-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
          <label htmlFor="signup-password">كلمة المرور</label>
          <input id="signup-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={event => setPassword(event.target.value)} />
          <label htmlFor="signup-confirm-password">تأكيد كلمة المرور</label>
          <input id="signup-confirm-password" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}</button>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        {message && <p className="capture-feedback good" role="status">{message}</p>}
        <p className="auth-footnote">لديك حساب بالفعل؟ <Link href="/login/">تسجيل الدخول</Link></p>
      </section>
    </main>
  );
}
