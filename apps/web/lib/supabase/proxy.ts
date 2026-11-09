import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function normalizePathname(pathname: string): string {
  // Next.js trailingSlash=true can present /login/ to middleware. Compare
  // canonical paths so the login page cannot redirect to itself forever.
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function isPathOrChild(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + '/');
}

export async function updateSession(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (
      pathname === '/login' ||
      isPathOrChild(pathname, '/auth') ||
      isPathOrChild(pathname, '/api')
    ) {
      return NextResponse.next({ request });
    }

    const destination = request.nextUrl.clone();
    destination.pathname = '/login';
    destination.search = '';
    return NextResponse.redirect(destination);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isLogin = pathname === '/login';
  const isAuthRoute = isPathOrChild(pathname, '/auth');
  const isApiRoute = isPathOrChild(pathname, '/api');
  const isPublic = isLogin || isAuthRoute || isApiRoute;

  if (error || !claims) {
    if (!isPublic) {
      const destination = request.nextUrl.clone();
      destination.pathname = '/login';
      destination.search = '';
      destination.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(destination);
    }
    return response;
  }

  if (isLogin) {
    const destination = request.nextUrl.clone();
    destination.pathname = '/';
    destination.search = '';
    return NextResponse.redirect(destination);
  }

  return response;
}
