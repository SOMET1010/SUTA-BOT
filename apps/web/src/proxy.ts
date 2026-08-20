import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminConfigured, verifyAdminSessionToken } from "@/lib/admin-auth";

/**
 * Protège `/admin` et `/api/admin` (cahier des charges, section 26). Next.js
 * 16 a renommé le Middleware en Proxy ; le comportement est identique. Ce
 * n'est qu'une vérification optimiste (lecture du cookie) — chaque page et
 * route admin revérifie la session côté serveur (défense en profondeur, cf.
 * `hasValidAdminSession` dans `apps/web/src/lib/admin-auth.ts`).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPath = pathname === "/admin/login" || pathname === "/api/admin/login";
  if (isLoginPath) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/admin");

  if (!isAdminConfigured()) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "L'administration n'est pas configurée (ADMIN_PASSWORD absent)." },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Session administrateur requise." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
