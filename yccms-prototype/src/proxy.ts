import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConnectivityError } from "@/lib/supabase/supabase-connectivity";
import { getSupabaseEnv } from "@/lib/supabase/supabase-env";

// Login gate: every page except /login requires a Supabase session.
// API routes are NOT redirected here — each route re-checks the session and answers 401 itself.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const env = getSupabaseEnv();

  if (!env) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  let signedIn = false;
  let unreachable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
    unreachable = isConnectivityError(error);
  } catch (err) {
    unreachable = isConnectivityError(err as Error); // e.g. paused Supabase project
  }

  if (!signedIn && !isLogin) {
    const url = new URL("/login", request.url);
    if (unreachable) url.searchParams.set("error", "db");
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (signedIn && isLogin) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
