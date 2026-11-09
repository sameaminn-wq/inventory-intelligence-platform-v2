'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';

type Store={id:string;name:string;slug:string;role?:string;status?:string};
type Member={id:string;user_id:string;email:string|null;role:string;status:string;created_at:string};
type Audit={id:string;action:string;previous_role:string|null;new_role:string|null;previous_status:string|null;new_status:string|null;created_at:string};
const roleNames:Record<string,string>={owner:'مالك',admin:'مدير',manager:'مشرف',employee:'موظف',viewer:'مشاهدة فقط'};
const statusNames:Record<string,string>={active:'نشط',invited:'بانتظار قبول الدعوة',suspended:'موقوف'};
const actionNames:Record<string,string>={invited:'دعوة',membership_added:'إضافة عضو',role_changed:'تغيير دور',suspended:'إيقاف',reactivated:'إعادة تفعيل'};

export default function TeamPage(){
 const [stores,setStores]=useState<Store[]>([]),[storeId,setStoreId]=useState('');
 const [members,setMembers]=useState<Member[]>([]),[audit,setAudit]=useState<Audit[]>([]);
 const [platform,setPlatform]=useState(false),[actorRole,setActorRole]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [name,setName]=useState(''),[slug,setSlug]=useState('');
 const [email,setEmail]=useState(''),[role,setRole]=useState('employee');

 const selected=useMemo(()=>stores.find(x=>x.id===storeId),[stores,storeId]);
 const loadStores=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/admin/members',{cache:'no-store'}),data=await res.json();
   if(!res.ok)throw new Error(data.error||'تعذر تحميل المتاجر.');
   setStores(data.stores??[]);setPlatform(data.isPlatformAdmin===true);
   const next=(data.stores??[]).some((x:Store)=>x.id===storeId)?storeId:(data.stores?.[0]?.id??'');
   setStoreId(next);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل المتاجر.');}
  finally{setLoading(false);}
 },[storeId]);
 const loadMembers=useCallback(async(id:string)=>{
  if(!id){setMembers([]);setAudit([]);return;}
  const res=await fetch('/api/admin/members?storeId='+encodeURIComponent(id),{cache:'no-store'}),data=await res.json();
  if(!res.ok)throw new Error(data.error||'تعذر تحميل أعضاء المتجر.');
  setMembers(data.members??[]);setAudit(data.audit??[]);setActorRole(data.actorRole??'');
 },[]);
 useEffect(()=>{void loadStores();},[loadStores]);
 useEffect(()=>{if(storeId)void loadMembers(storeId).catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل الأعضاء.'));},[storeId,loadMembers]);

 async function post(body:Record<string,string>){
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/admin/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json();if(!res.ok)throw new Error(data.error||'تعذر تنفيذ العملية.');
   setNotice(body.action==='create_store'?'تم إنشاء المتجر وإسناد دور المالك.':(data.invited?'أُرسلت الدعوة إلى البريد الإلكتروني.':'تمت إضافة الحساب الموجود إلى المتجر.'));
   if(body.action==='create_store'){setName('');setSlug('');await loadStores();}
   else{setEmail('');await loadMembers(storeId);}
  }catch(e){setError(e instanceof Error?e.message:'حدث خطأ.');}
  finally{setBusy(false);}
 }
 async function patch(member:Member,change:{role?:string;status?:string}){
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/admin/members',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({storeId,membershipId:member.id,...change})});
   const data=await res.json();if(!res.ok)throw new Error(data.error||'تعذر تحديث العضوية.');
   setNotice('تم تحديث العضوية.');await loadMembers(storeId);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحديث العضوية.');}
  finally{setBusy(false);}
 }
 const canInvite=platform||actorRole==='owner'||actorRole==='admin';
 return <AppShell title="إدارة الفريق والمتاجر" description="إنشاء المتاجر، ودعوة الموظفين، وتحديد الصلاحيات، ومراجعة سجل التغييرات.">
  {error&&<div className="error-message" role="alert">{error}</div>}
  {notice&&<div className="notice" role="status">{notice}</div>}
  {platform&&<section className="panel team-section">
   <h2>إنشاء متجر جديد</h2><p className="panel-subtitle">خاص بمسؤول المنصة المحدد في إعدادات الخادم.</p>
   <form className="team-form" onSubmit={e=>{e.preventDefault();void post({action:'create_store',name,slug});}}>
    <label>اسم المتجر<input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="متجر النور"/></label>
    <label>معرّف المتجر<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" dir="ltr" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="al-noor-store"/></label>
    <button className="primary-button" disabled={busy||!name.trim()||!slug.trim()}>{busy?'جارٍ الإنشاء…':'إنشاء المتجر'}</button>
   </form>
  </section>}
  <section className="panel team-section">
   <div className="section-head"><div><h2>المتاجر المتاحة</h2><p className="panel-subtitle">المتاجر التي لديك صلاحية إدارتها فقط.</p></div><button className="secondary-button" disabled={loading} onClick={()=>void loadStores()}>تحديث</button></div>
   {loading?<p>جارٍ التحميل…</p>:stores.length===0?<div className="empty-state"><h3>لا توجد متاجر مرتبطة بحسابك</h3><p>{platform?'أنشئ متجرًا جديدًا من الأعلى.':'اطلب من مسؤول المنصة إسناد دور مالك أو مدير إلى حسابك.'}</p></div>:
    <label className="team-field">اختر المتجر<select value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}{s.role?' — '+(roleNames[s.role]??s.role):''}</option>)}</select></label>}
  </section>
  {selected&&<>
   {canInvite&&<section className="panel team-section">
    <h2>دعوة عضو جديد</h2><p className="panel-subtitle">الحساب الجديد يستقبل رابط دعوة بالبريد. الحساب الموجود يُضاف مباشرة.</p>
    <form className="team-form invite-form" onSubmit={e=>{e.preventDefault();void post({action:'invite_member',storeId,email,role});}}>
     <label>البريد الإلكتروني<input type="email" required maxLength={254} dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@example.com"/></label>
     <label>الدور<select value={role} onChange={e=>setRole(e.target.value)}><option value="employee">موظف</option><option value="manager">مشرف</option><option value="viewer">مشاهدة فقط</option></select></label>
     <button className="primary-button" disabled={busy||!email.trim()}>{busy?'جارٍ التنفيذ…':'إرسال الدعوة / الإضافة'}</button>
    </form>
   </section>}
   <section className="panel team-section">
    <div className="section-head"><div><h2>أعضاء {selected.name}</h2><p className="panel-subtitle">إدارة الأدوار وحالة الوصول.</p></div><span className="team-count">{members.length} عضو</span></div>
    <div className="table-wrap"><table className="data-table team-table"><thead><tr><th>الحساب</th><th>الدور</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
     {members.map(m=>{const manageable=!busy&&m.user_id!==undefined&&m.role!=='owner'&&(actorRole==='owner'||(actorRole==='admin'&&!['owner','admin'].includes(m.role))||platform);
      return <tr key={m.id}><td><strong>{m.email??'حساب بدون بريد ظاهر'}</strong><small className="team-id">{m.user_id}</small></td>
       <td>{manageable?<select aria-label="دور العضو" value={m.role} onChange={e=>void patch(m,{role:e.target.value})}>{(['admin','manager','employee','viewer'] as const).filter(x=>actorRole==='owner'||platform||x!=='admin').map(x=><option key={x} value={x}>{roleNames[x]}</option>)}</select>:roleNames[m.role]??m.role}</td>
       <td><span className={'member-status '+m.status}>{statusNames[m.status]??m.status}</span></td>
       <td>{manageable&&m.status!=='invited'?<button className="text-button" disabled={busy} onClick={()=>void patch(m,{status:m.status==='active'?'suspended':'active'})}>{m.status==='active'?'إيقاف الوصول':'إعادة التفعيل'}</button>:'—'}</td></tr>;
     })}
     {members.length===0&&<tr><td className="table-empty" colSpan={4}>لا يوجد أعضاء.</td></tr>}
    </tbody></table></div>
   </section>
   <section className="panel team-section"><h2>سجل تغييرات العضويات</h2><p className="panel-subtitle">آخر 50 عملية على هذا المتجر.</p>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>العملية</th><th>الدور السابق</th><th>الدور الجديد</th><th>التاريخ</th></tr></thead><tbody>
     {audit.map(a=><tr key={a.id}><td>{actionNames[a.action]??a.action}</td><td>{a.previous_role?roleNames[a.previous_role]:'—'}</td><td>{a.new_role?roleNames[a.new_role]:'—'}</td><td>{new Date(a.created_at).toLocaleString('ar-EG')}</td></tr>)}
     {audit.length===0&&<tr><td colSpan={4} className="table-empty">لا توجد تغييرات مسجلة.</td></tr>}
    </tbody></table></div>
   </section>
  </>}
 </AppShell>;
}
