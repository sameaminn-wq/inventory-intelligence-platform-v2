'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateStoreForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setCreated(false);
    try {
      const response = await fetch('/api/stores', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const result = await response.json() as { error?: string; storeId?: string };
      if (!response.ok || !result.storeId) throw new Error(result.error || 'تعذر إنشاء المتجر.');
      setName(''); setSlug(''); setCreated(true); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع.');
    } finally { setBusy(false); }
  }

  return <section className="panel team-section">
    <h2>إنشاء متجر جديد</h2>
    <p className="panel-subtitle">سيصبح حسابك مالك المتجر تلقائياً. لا يمكن لأي مستخدم آخر الوصول إليه دون عضوية.</p>
    <form className="team-form" onSubmit={submit}>
      <label>اسم المتجر<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: متجر النور" /></label>
      <label>رابط المتجر (بالإنجليزية)<input required minLength={3} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder="al-noor-store" dir="ltr" /></label>
      <button className="primary-button" type="submit" disabled={busy}>{busy?'جارٍ الإنشاء…':'إنشاء المتجر'}</button>
    </form>
    {error && <p className="error-message" role="alert">{error}</p>}
    {created && <p className="capture-feedback good" role="status">تم إنشاء المتجر وإسناد دور المالك لحسابك.</p>}
  </section>;
}
