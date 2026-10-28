import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';

const PUBLIC_PATHS = ['/login'];

/**
 * Refreshes the Supabase session cookie on every request (required by
 * @supabase/ssr — access tokens are short-lived) and redirects signed-out
 * visitors to /login. This is a convenience redirect only, not the real
 * authorization boundary: every page's own Server Component query is still
 * subject to RLS, and the admin-role check happens in `requireAdmin()`
 * (`src/lib/auth.ts`), called from `app/(admin)/layout.tsx` (deactivation/
 * role changes need a real profile lookup, not just "is there a session").
 *
 * Deliberately does NOT redirect a signed-in user away from /login — a
 * signed-in *non-admin* (e.g. a worker who mistakenly opens this site) must
 * still be able to land on /login and see "you don't have access" with a
 * sign-out button, not get bounced back into the admin area and immediately
 * back out again. /login itself handles the "already signed in as an admin"
 * case by redirecting to "/".
 */
/**
 * Checked in-function (plain string checks) rather than relied on purely
 * via `proxyConfig.matcher`'s regex — verified live against the production
 * deployment that the matcher alone let `_next/static/**` requests reach
 * this function and get redirected to `/login`, breaking every static
 * asset (CSS/JS) for a signed-out visitor. The matcher below is kept as a
 * first-pass filter for efficiency, but this check is what actually
 * guarantees correctness regardless of matcher/path-to-regexp quirks.
 */
function isAlwaysPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  if (isAlwaysPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!data.user && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const proxyConfig = {
  matcher: [
    /*
     * Run on every request except static assets, so the session cookie
     * stays fresh everywhere a page might read it.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
