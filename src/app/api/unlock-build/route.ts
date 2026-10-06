import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { accessCookieName, accessCookieValue, verifyAccessPassword } from "@/lib/buildAccess";

/**
 * Password check for a privately published Build. On success sets an
 * httpOnly cookie bound to the current password hash (so regenerating the
 * password logs everyone out).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  const { data: build } = await getSupabaseAdmin()
    .from("builds")
    .select("slug, access_password_hash")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "private")
    .eq("hidden", false)
    .maybeSingle();

  // Same answer for "no such build" and "wrong password", with a small delay
  // to take the edge off guessing.
  const ok = Boolean(build && password && verifyAccessPassword(password, build.access_password_hash));
  if (!ok || !build) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(accessCookieName(build.slug), accessCookieValue(build.slug, build.access_password_hash), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
