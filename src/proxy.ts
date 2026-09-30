import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

const PROTECTED = [
  "/overview", "/pipeline", "/accounts", "/leads", "/conversations", "/briefings", "/actions",
  "/insights", "/reports", "/assistant", "/team", "/activity", "/settings", "/usage",
  "/subscription", "/onboarding",
];
const AUTH_PAGES = ["/signin", "/signup", "/forgot-password"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuth = matches(path, PROTECTED);

  if (!isSupabaseConfigured()) {
    if (needsAuth || matches(path, AUTH_PAGES) || path.startsWith("/invite")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && needsAuth) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && matches(path, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/billing).*)"],
};
