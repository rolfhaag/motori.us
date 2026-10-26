import { NextRequest, NextResponse } from "next/server";
import { accountEmail, followAsUser, listFollows, unfollowAsUser } from "@/lib/follow";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";

/** Signed-in follows: list what I follow, follow something, unfollow it. */
async function who(req: NextRequest) {
  try {
    const { privyUserId, email } = await verifyRequestUser(req);
    return { email: await accountEmail(privyUserId, email) };
  } catch (err) {
    if (err instanceof AuthError) return { error: NextResponse.json({ error: err.message }, { status: err.status }) };
    return { error: NextResponse.json({ error: "Unexpected error." }, { status: 500 }) };
  }
}

export async function GET(req: NextRequest) {
  const w = await who(req);
  if ("error" in w) return w.error;
  if (!w.email) return NextResponse.json({ hasEmail: false, follows: [] });
  return NextResponse.json({ hasEmail: true, follows: await listFollows(w.email) });
}

export async function POST(req: NextRequest) {
  const w = await who(req);
  if ("error" in w) return w.error;
  if (!w.email) {
    return NextResponse.json({ error: "Add an email address to follow.", code: "email_required" }, { status: 422 });
  }
  const body = await req.json().catch(() => ({}));
  const r = await followAsUser(req, w.email, body?.scope);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const w = await who(req);
  if ("error" in w) return w.error;
  if (!w.email) return NextResponse.json({ ok: true });
  const scope = new URL(req.url).searchParams.get("scope");
  const r = await unfollowAsUser(w.email, scope);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
