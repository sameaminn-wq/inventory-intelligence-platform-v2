import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';

function safeInternalRedirect(request: NextRequest): string {
  const requested = request.nextUrl.searchParams.get('next');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(requested)) return '/';

  try {
    const requestOrigin = new URL(request.url).origin;
    const target = new URL(requested, request.url);
    if (target.origin !== requestOrigin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeInternalRedirect(request);
  if (!code) return NextResponse.redirect(new URL('/login?invite=invalid', request.url));
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (typeof userId === 'string') {
      const admin = createAdminClient();
      const { error: membershipError } = await admin.from('store_memberships')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('status', 'invited');
      if (membershipError) throw membershipError;
    }
    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?invite=invalid', request.url));
  }
}
