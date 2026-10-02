import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";

/**
 * Toggles a user's banned flag. Visibility of their Builder/Build pages
 * cascades from this automatically (computed as NOT hidden AND NOT
 * owner.banned wherever those are read) -- un-banning restores whatever
 * the independent `hidden` flags were already set to.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminId: string;
  try {
    ({ privyUserId: adminId } = await requireAdmin(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const banned = Boolean(body.banned);

  if (id === adminId && banned) {
    return NextResponse.json({ error: "You can't ban your own account." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("users").update({ banned }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, banned });
}
