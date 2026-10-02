import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";

type BuildAction = "publish" | "deny" | "hide" | "unhide";

/**
 * Build submission review, structurally ready for Chunk C (the Submit Build
 * flow). Nothing creates `builds` rows yet, so this has no data to act on
 * until then, but Admin's review surface is in place.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as BuildAction;
  const notes = (body.notes as string | undefined)?.trim() || null;

  const supabase = getSupabaseAdmin();

  if (action === "publish" || action === "deny") {
    const { data: build } = await supabase.from("builds").select("status").eq("id", id).maybeSingle();
    if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
    if (build.status !== "submitted") {
      return NextResponse.json({ error: "This build has already been decided." }, { status: 409 });
    }
    const { error } = await supabase
      .from("builds")
      .update({ status: action === "publish" ? "published" : "denied", admin_notes: notes })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: action === "publish" ? "published" : "denied" });
  }

  if (action === "hide" || action === "unhide") {
    const { error } = await supabase
      .from("builds")
      .update({ hidden: action === "hide" })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, hidden: action === "hide" });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
