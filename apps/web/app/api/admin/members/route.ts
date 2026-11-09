import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

export const runtime = 'nodejs';
type Role = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';
type Status = 'invited' | 'active' | 'suspended';
const roles: Role[] = ['owner', 'admin', 'manager', 'employee', 'viewer'];
const platformAdmins = () => new Set((process.env.PLATFORM_ADMIN_USER_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean));
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

async function authContext() {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== 'string' || !userId) return null;
  return { supabase, userId };
}
async function managerRole(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, storeId: string, userId: string) {
  const { data, error } = await supabase.from('store_memberships').select('role,status')
    .eq('store_id', storeId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'active' || !['owner','admin'].includes(data.role)) return null;
  return data.role as 'owner'|'admin';
}
async function writeAudit(admin: ReturnType<typeof createAdminClient>, row: {
  store_id: string; actor_user_id: string; target_user_id: string;
  action: 'invited'|'membership_added'|'role_changed'|'suspended'|'reactivated';
  previous_role?: Role|null; new_role?: Role|null; previous_status?: Status|null; new_status?: Status|null;
}) {
  const { error } = await admin.from('store_membership_audit').insert(row);
  if (error) throw error;
}
async function findUser(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page=1; page<=10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find(u => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await authContext();
    if (!ctx) return fail('يجب تسجيل الدخول أولًا.', 401);
    const admin = createAdminClient();
    const platform = platformAdmins().has(ctx.userId);
    const storeId = request.nextUrl.searchParams.get('storeId');
    if (!storeId) {
      if (platform) {
        const { data, error } = await admin.from('stores').select('id,name,slug,status').order('created_at',{ascending:false});
        if (error) return fail('تعذر تحميل المتاجر.',503);
        return NextResponse.json({ isPlatformAdmin: true, stores: data ?? [] });
      }
      const { data, error } = await ctx.supabase.from('store_memberships')
        .select('store_id,role,status,stores(id,name,slug,status)')
        .eq('user_id',ctx.userId).eq('status','active');
      if (error) return fail('تعذر تحميل عضوياتك.',503);
      const stores = (data ?? []).flatMap(x => {
        const relation = Array.isArray(x.stores) ? x.stores[0] : x.stores;
        if (!relation || relation.status !== 'active') return [];
        return [{
          id: x.store_id,
          name: relation.name,
          slug: relation.slug,
          role: x.role,
          status: x.status,
        }];
      });
      return NextResponse.json({ isPlatformAdmin:false, stores });
    }
    const actorRole = await managerRole(ctx.supabase,storeId,ctx.userId);
    if (!actorRole && !platform) return fail('ليس لديك صلاحية إدارة أعضاء هذا المتجر.',403);
    const { data: memberships, error } = await admin.from('store_memberships')
      .select('id,user_id,role,status,created_at,updated_at').eq('store_id',storeId).order('created_at');
    if (error) return fail('تعذر تحميل أعضاء المتجر.',503);
    const ids = new Set((memberships ?? []).map(x => x.user_id));
    const emails = new Map<string,string|null>();
    for (let page=1; page<=10; page++) {
      const { data, error: usersError } = await admin.auth.admin.listUsers({page,perPage:1000});
      if (usersError) return fail('تعذر تحميل حسابات الأعضاء.',503);
      for (const u of data.users) if (ids.has(u.id)) emails.set(u.id,u.email ?? null);
      if (emails.size >= ids.size || data.users.length < 1000) break;
    }
    const [{data:store},{data:audit,error:auditError}] = await Promise.all([
      admin.from('stores').select('id,name,slug').eq('id',storeId).maybeSingle(),
      admin.from('store_membership_audit').select('id,actor_user_id,target_user_id,action,previous_role,new_role,previous_status,new_status,created_at')
        .eq('store_id',storeId).order('created_at',{ascending:false}).limit(50)
    ]);
    if (auditError) return fail('تعذر تحميل سجل التغييرات.',503);
    return NextResponse.json({
      store, actorRole:actorRole ?? 'platform_admin',
      members:(memberships ?? []).map(x=>({...x,email:emails.get(x.user_id) ?? null})),
      audit:audit ?? []
    });
  } catch {
    return fail('حدث خطأ أثناء تحميل بيانات الإدارة.',500);
  }
}

export async function POST(request: NextRequest) {
  let invitedUserId: string|null = null;
  try {
    const ctx = await authContext();
    if (!ctx) return fail('يجب تسجيل الدخول أولًا.',401);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('بيانات الطلب غير صالحة.',400);
    const input = body as Record<string,unknown>;
    const admin = createAdminClient();
    const platform = platformAdmins().has(ctx.userId);
    if (input.action === 'create_store') {
      if (!platform) return fail('إنشاء المتاجر متاح لمسؤول المنصة فقط.',403);
      if (typeof input.name !== 'string' || input.name.trim().length<2 || input.name.trim().length>160) return fail('اسم المتجر غير صالح.',400);
      const slug = typeof input.slug==='string' ? input.slug.trim().toLowerCase() : '';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>80) return fail('معرّف المتجر غير صالح.',400);
      const {data:store,error} = await admin.from('stores').insert({name:input.name.trim(),slug,created_by:ctx.userId}).select('id,name,slug').single();
      if (error) return fail(error.code==='23505'?'معرّف المتجر مستخدم بالفعل.':'تعذر إنشاء المتجر.',503);
      const {error:memberError} = await admin.from('store_memberships').insert({store_id:store.id,user_id:ctx.userId,role:'owner',status:'active'});
      if (memberError) { await admin.from('stores').delete().eq('id',store.id); return fail('تعذر إنشاء عضوية مالك المتجر.',503); }
      await writeAudit(admin,{store_id:store.id,actor_user_id:ctx.userId,target_user_id:ctx.userId,action:'membership_added',new_role:'owner',new_status:'active'});
      return NextResponse.json({store},{status:201});
    }
    if (input.action !== 'invite_member' || typeof input.storeId!=='string' || typeof input.email!=='string' ||
        typeof input.role!=='string' || !['manager','employee','viewer'].includes(input.role)) return fail('بيانات الدعوة غير مكتملة أو الدور غير مسموح.',400);
    const actor = await managerRole(ctx.supabase,input.storeId,ctx.userId);
    if (!actor && !platform) return fail('ليس لديك صلاحية دعوة أعضاء لهذا المتجر.',403);
    const email = input.email.trim().toLowerCase();
    if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('البريد الإلكتروني غير صالح.',400);
    const existing = await findUser(admin,email);
    let targetId: string;
    let invited = false;
    if (existing) targetId = existing.id;
    else {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!siteUrl) return fail('إعداد NEXT_PUBLIC_SITE_URL مفقود.',503);
      const {data,error} = await admin.auth.admin.inviteUserByEmail(email,{redirectTo:new URL('/auth/callback?next=%2Fteam',siteUrl).toString()});
      if (error || !data.user) return fail('تعذر إرسال الدعوة. تحقق من إعداد البريد.',502);
      targetId = data.user.id; invited = true; invitedUserId = targetId;
    }
    const {data:old,error:oldError} = await admin.from('store_memberships').select('id').eq('store_id',input.storeId).eq('user_id',targetId).maybeSingle();
    if (oldError) return fail('تعذر التحقق من العضوية.',503);
    if (old) return fail('هذا المستخدم عضو بالفعل في المتجر.',409);
    const status: Status = invited ? 'invited':'active';
    const role = input.role as Role;
    const {error:insertError} = await admin.from('store_memberships').insert({store_id:input.storeId,user_id:targetId,role,status});
    if (insertError) {
      if (invited) await admin.auth.admin.deleteUser(targetId);
      invitedUserId = null;
      return fail('تعذر إضافة العضوية.',503);
    }
    invitedUserId = null;
    await writeAudit(admin,{store_id:input.storeId,actor_user_id:ctx.userId,target_user_id:targetId,action:invited?'invited':'membership_added',new_role:role,new_status:status});
    return NextResponse.json({email,role,status,invited},{status:201});
  } catch {
    if (invitedUserId) {
      try { await createAdminClient().auth.admin.deleteUser(invitedUserId); } catch { /* keep the original error response */ }
    }
    return fail('حدث خطأ أثناء تنفيذ عملية الإدارة.',500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await authContext();
    if (!ctx) return fail('يجب تسجيل الدخول أولًا.',401);
    const body: unknown = await request.json();
    if (!body || typeof body!=='object' || Array.isArray(body)) return fail('بيانات الطلب غير صالحة.',400);
    const input = body as Record<string,unknown>;
    if (typeof input.storeId!=='string' || typeof input.membershipId!=='string') return fail('معرّفات المتجر والعضوية مطلوبة.',400);
    const actor = await managerRole(ctx.supabase,input.storeId,ctx.userId);
    const platform = platformAdmins().has(ctx.userId);
    if (!actor && !platform) return fail('ليس لديك صلاحية إدارة الأعضاء.',403);
    const admin = createAdminClient();
    const {data:target,error} = await admin.from('store_memberships').select('id,user_id,role,status')
      .eq('id',input.membershipId).eq('store_id',input.storeId).maybeSingle();
    if (error || !target) return fail('العضوية غير موجودة.',404);
    if (target.user_id===ctx.userId) return fail('لا يمكنك تعديل عضويتك بنفسك.',400);
    if (target.role==='owner') return fail('لا يمكن تغيير مالك المتجر من هذه الشاشة.',403);
    if (actor==='admin' && target.role==='admin') return fail('مدير المتجر لا يستطيع تعديل مدير آخر.',403);
    const patch: {role?:Role;status?:Status} = {};
    let action: 'role_changed'|'suspended'|'reactivated';
    if (typeof input.role==='string') {
      if (!roles.includes(input.role as Role) || input.role==='owner') return fail('الدور الجديد غير مسموح.',400);
      if (actor==='admin' && input.role==='admin') return fail('ترقية عضو إلى مدير متاحة للمالك فقط.',403);
      patch.role = input.role as Role; action='role_changed';
    } else if (input.status==='active' || input.status==='suspended') {
      if (input.status==='active' && target.status==='invited') return fail('لا يمكن تفعيل دعوة قبل قبولها.',400);
      patch.status=input.status as Status; action=input.status==='active'?'reactivated':'suspended';
    } else return fail('حدد الدور أو الحالة الجديدة.',400);
    const {error:updateError} = await admin.from('store_memberships').update({...patch,updated_at:new Date().toISOString()}).eq('id',target.id);
    if (updateError) return fail('تعذر تحديث العضوية.',503);
    await writeAudit(admin,{
      store_id:input.storeId,actor_user_id:ctx.userId,target_user_id:target.user_id,action,
      previous_role:target.role as Role,new_role:patch.role ?? target.role as Role,
      previous_status:target.status as Status,new_status:patch.status ?? target.status as Status
    });
    return NextResponse.json({success:true});
  } catch {
    return fail('حدث خطأ أثناء تحديث العضوية.',500);
  }
}
