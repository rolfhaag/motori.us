import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { assignBuildSlug } from "@/lib/buildSlug";

type BuildAction = "publish" | "deny_resubmit" | "deny_final" | "hide" | "unhide";

/**
 * Build submission review: Admin publishes a submitted Build, sends it back
 * for changes ('changes_requested' -- the Builder can edit and resubmit, same
 * shape as applications' deny_resubmit), or denies it outright ('denied' --
 * terminal, mirrors applications' deny_final), plus hides/unhides one
 * already published. Publishing assigns the public slug.
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

  if (action === "deny_resubmit" && !notes) {
    return NextResponse.json(
      { error: "A note explaining what to change is required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (action === "publish" || action === "deny_resubmit" || action === "deny_final") {
    const { data: build } = await supabase
      .from("builds")
      .select("status, slug, make, model, trim")
      .eq("id", id)
      .maybeSingle();
    if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
    if (build.status !== "submitted") {
      return NextResponse.json({ error: "This build has already been decided." }, { status: 409 });
    }

    const newStatus =
      action === "publish" ? "published" : action === "deny_resubmit" ? "changes_requested" : "denied";

    const slug =
      action === "publish" && !build.slug
        ? await assignBuildSlug(build.make, build.model, build.trim)
        : build.slug;

    const { error } = await supabase
      .from("builds")
      .update({
        status: newStatus,
        admin_notes: notes,
        ...(action === "publish" ? { slug } : {}),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: newStatus, slug });
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
