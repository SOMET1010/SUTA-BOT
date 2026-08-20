import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  checkAdminPassword,
  isAdminConfigured,
  issueAdminSessionToken,
} from "@/lib/admin-auth";

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12h

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return Response.json(
      { error: "L'administration n'est pas configurée (ADMIN_PASSWORD absent)." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!password || !checkAdminPassword(password)) {
    return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const token = issueAdminSessionToken();
  if (!token) {
    // Ne devrait pas arriver puisque isAdminConfigured() est vrai ci-dessus.
    return Response.json({ error: "Configuration invalide." }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return Response.json({ ok: true });
}
