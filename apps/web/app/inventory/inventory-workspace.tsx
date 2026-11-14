'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Store = { id: string; name: string; slug: string };
type Product = {
  id: string; name: string; sku: string | null; unit: string;
  quantity_on_hand: number; minimum_quantity: number;
};
type Movement = {
  id: string; product_id: string; movement_type: string; quantity_delta: number;
  quantity_after: number; notes: string | null; created_at: string;
};

export function InventoryWorkspace({ stores, initialStoreId }: { stores: Store[]; initialStoreId: string }) {
  const [storeId, setStoreId] = useState(initialStoreId);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('piece');
  const [minimum, setMinimum] = useState('0');
  const [productBusy, setProductBusy] = useState(false);
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState<'inbound'|'outbound'|'adjustment'>('inbound');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [movementBusy, setMovementBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/inventory?storeId=' + encodeURIComponent(storeId), { cache: 'no-store' });
      const result = await response.json() as { error?: string; products?: Product[]; movements?: Movement[] };
      if (!response.ok) throw new Error(result.error || 'تعذر تحميل المخزون.');
      setProducts(result.products ?? []);
      setMovements(result.movements ?? []);
      setProductId(current => (result.products ?? []).some(p => p.id === current) ? current : result.products?.[0]?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المخزون.');
    } finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (productBusy || !storeId) return;
    setProductBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, name, sku: sku || null, unit, minimumQuantity: Number(minimum) }),
      });
      const result = await response.json() as { error?: string; productId?: string };
      if (!response.ok) throw new Error(result.error || 'تعذر إضافة المنتج.');
      setName(''); setSku(''); setMinimum('0');
      setNotice('تمت إضافة المنتج إلى كتالوج المتجر.');
      await load();
      if (result.productId) setProductId(result.productId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إضافة المنتج.'); }
    finally { setProductBusy(false); }
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (movementBusy || !storeId || !productId) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || (movementType === 'adjustment' ? amount === 0 : amount <= 0)) { setError(movementType === 'adjustment' ? 'أدخل قيمة تسوية موجبة أو سالبة، لا تساوي صفراً.' : 'أدخل كمية أكبر من صفر.'); return; }
    setMovementBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/inventory/movements', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, productId, type: movementType, quantity: movementType === 'outbound' ? Math.abs(amount) : amount, notes }),
      });
      const result = await response.json() as { error?: string; quantityAfter?: number };
      if (!response.ok) throw new Error(result.error || 'تعذر تسجيل الحركة.');
      setQuantity(''); setNotes('');
      setNotice('تم تسجيل الحركة. الرصيد الجديد: ' + result.quantityAfter);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الحركة.'); }
    finally { setMovementBusy(false); }
  }

  if (!stores.length) return <section className="panel"><div className="empty-state"><div className="empty-icon">▦</div><h3>أنشئ متجرك أولاً</h3><p>لا يمكن تسجيل المنتجات قبل إنشاء متجر وربط حسابك به.</p><a className="primary-button" href="/stores/">الانتقال إلى المتاجر</a></div></section>;

  return <>
    <section className="panel">
      <div className="store-picker"><label htmlFor="inventory-store">المتجر المحدد</label><select id="inventory-store" value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name} — {s.slug}</option>)}</select></div>
      <div className="section-head"><div><h2>كتالوج المنتجات</h2><p className="panel-subtitle">بيانات مباشرة من قاعدة البيانات، مع عزل تلقائي لكل متجر.</p></div><span className="team-count">{products.length} منتج</span></div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="capture-feedback good" role="status">{notice}</p>}
      {loading ? <p className="panel-subtitle">جارٍ تحميل بيانات المخزون…</p> :
       <div className="table-wrap"><table className="data-table"><thead><tr><th>المنتج</th><th>رمز المنتج</th><th>الوحدة</th><th>الرصيد</th><th>حد التنبيه</th><th>الحالة</th></tr></thead><tbody>
        {products.length ? products.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td dir="ltr">{p.sku || '—'}</td><td>{p.unit}</td><td>{Number(p.quantity_on_hand).toLocaleString('ar-EG')}</td><td>{Number(p.minimum_quantity).toLocaleString('ar-EG')}</td><td><span className={Number(p.quantity_on_hand)<=Number(p.minimum_quantity)?'member-status invited':'member-status active'}>{Number(p.quantity_on_hand)<=Number(p.minimum_quantity)?'مخزون منخفض':'متوفر'}</span></td></tr>) : <tr><td colSpan={6} className="table-empty">لا توجد منتجات بعد. أضف أول منتج من النموذج أدناه.</td></tr>}
       </tbody></table></div>}
    </section>

    <section className="panel team-section">
      <h2>إضافة منتج</h2><p className="panel-subtitle">تتطلب هذه العملية دور المالك أو المدير أو مدير المتجر.</p>
      <form className="team-form" onSubmit={addProduct}>
        <label>اسم المنتج<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المنتج" /></label>
        <label>رمز المنتج (اختياري)<input maxLength={80} value={sku} onChange={e=>setSku(e.target.value)} dir="ltr" placeholder="SKU-001" /></label>
        <label>وحدة القياس<input required maxLength={32} value={unit} onChange={e=>setUnit(e.target.value)} placeholder="قطعة / كرتونة / كجم" /></label>
        <label>حد التنبيه للمخزون<input type="number" min="0" step="0.001" required value={minimum} onChange={e=>setMinimum(e.target.value)} /></label>
        <button className="primary-button" type="submit" disabled={productBusy}>{productBusy?'جارٍ الحفظ…':'إضافة المنتج'}</button>
      </form>
    </section>

    <section className="panel team-section">
      <h2>تسجيل حركة مخزون</h2><p className="panel-subtitle">كل حركة تُسجل كسطر مستقل، ويُحدّث الرصيد داخل معاملة ذرية تمنع الرصيد السالب.</p>
      <form className="team-form" onSubmit={addMovement}>
        <label>المنتج<select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">اختر منتجاً</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>نوع الحركة<select value={movementType} onChange={e=>setMovementType(e.target.value as typeof movementType)}><option value="inbound">إضافة للمخزون</option><option value="outbound">صرف من المخزون</option><option value="adjustment">تسوية (زيادة أو نقص)</option></select></label>
        <label>الكمية<input type="number" min={movementType === 'adjustment' ? undefined : '0.001'} step="0.001" required value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0" /></label>
        <label>ملاحظات (اختياري)<input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
        <button className="primary-button" type="submit" disabled={movementBusy || !products.length}>{movementBusy?'جارٍ التسجيل…':'تسجيل الحركة'}</button>
      </form>
    </section>

    <section className="panel team-section">
      <div className="section-head"><div><h2>آخر حركات المخزون</h2><p className="panel-subtitle">آخر 30 حركة مسجلة في المتجر المحدد.</p></div><button className="secondary-button" type="button" onClick={()=>void load()}>تحديث</button></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>التاريخ</th><th>معرّف المنتج</th><th>نوع الحركة</th><th>التغير</th><th>الرصيد بعدها</th><th>ملاحظات</th></tr></thead><tbody>
        {movements.length ? movements.map(m=><tr key={m.id}><td>{new Intl.DateTimeFormat('ar-EG',{dateStyle:'short',timeStyle:'short'}).format(new Date(m.created_at))}</td><td dir="ltr">{m.product_id.slice(0,8)}</td><td>{m.movement_type==='inbound'?'إضافة':m.movement_type==='outbound'?'صرف':'تسوية'}</td><td>{Number(m.quantity_delta).toLocaleString('ar-EG')}</td><td>{Number(m.quantity_after).toLocaleString('ar-EG')}</td><td>{m.notes || '—'}</td></tr>) : <tr><td colSpan={6} className="table-empty">لا توجد حركات مسجلة بعد.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
