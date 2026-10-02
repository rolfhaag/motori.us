import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";

/** Independent of ban -- Admin can hide/unhide a Builder's page on its own. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const hidden = Boolean(body.hidden);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("builders").update({ hidden }).eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hidden });
}
