import { NextRequest, NextResponse, after } from "next/server";
import { notifyBuildDecided } from "@/lib/email/notify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { assignBuildSlug } from "@/lib/buildSlug";
import { generateAccessPassword, hashAccessPassword } from "@/lib/buildAccess";

type BuildAction =
  | "publish"
  | "publish_private"
  | "new_password"
  | "make_public"
  | "deny_resubmit"
  | "deny_final"
  | "hide"
  | "unhide";

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
  const password = generateAccessPassword();

  if (
    action === "publish" ||
    action === "publish_private" ||
    action === "deny_resubmit" ||
    action === "deny_final"
  ) {
    const { data: build } = await supabase
      .from("builds")
      .select("status, slug, year, make, model, trim")
      .eq("id", id)
      .maybeSingle();
    if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
    if (build.status !== "submitted") {
      return NextResponse.json({ error: "This build has already been decided." }, { status: 409 });
    }

    const publishing = action === "publish" || action === "publish_private";
    const newStatus = publishing ? "published" : action === "deny_resubmit" ? "changes_requested" : "denied";

    const slug =
      publishing && !build.slug
        ? await assignBuildSlug(build.year, build.make, build.model, build.trim)
        : build.slug;

    const { error } = await supabase
      .from("builds")
      .update({
        status: newStatus,
        admin_notes: notes,
        ...(publishing ? { slug } : {}),
        ...(action === "publish" ? { visibility: "public", access_password_hash: null } : {}),
        ...(action === "publish_private" ? { visibility: "private", access_password_hash: hashAccessPassword(password) } : {}),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Emails: "approved and live" only when it goes public (private publishing
    // is an Admin-only tool and sends nothing), or the needs-changes / denied
    // email carrying the Admin's note.
    const stamp = new Date().toISOString();
    if (action === "publish") after(() => notifyBuildDecided(id, "live", { stamp }));
    else if (action === "deny_resubmit") after(() => notifyBuildDecided(id, "needs_changes", { note: notes, stamp }));
    else if (action === "deny_final") after(() => notifyBuildDecided(id, "denied", { note: notes, stamp }));
    // The plain password is returned exactly once, here.
    return NextResponse.json({
      ok: true,
      status: newStatus,
      slug,
      ...(action === "publish_private" ? { password } : {}),
    });
  }

  if (action === "new_password" || action === "make_public") {
    const { data: build } = await supabase
      .from("builds")
      .select("status, visibility, slug")
      .eq("id", id)
      .maybeSingle();
    if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
    if (build.status !== "published" || build.visibility !== "private") {
      return NextResponse.json({ error: "This build isn't privately published." }, { status: 409 });
    }
    if (action === "make_public") {
      const { error } = await supabase
        .from("builds")
        .update({ visibility: "public", access_password_hash: null })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // First time this build goes public: send "approved and live" (once per build).
      after(() => notifyBuildDecided(id, "live", { stamp: new Date().toISOString() }));
      return NextResponse.json({ ok: true, visibility: "public", slug: build.slug });
    }
    const newPassword = generateAccessPassword();
    const { error } = await supabase
      .from("builds")
      .update({ access_password_hash: hashAccessPassword(newPassword) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug: build.slug, password: newPassword });
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
