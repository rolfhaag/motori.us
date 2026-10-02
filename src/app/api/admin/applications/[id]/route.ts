import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { isHandleAvailable } from "@/lib/builderHandle";

type DecideAction = "approve" | "deny_resubmit" | "deny_final";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
  const action = body.action as DecideAction;
  const notes = (body.notes as string | undefined)?.trim() || null;

  if (!["approve", "deny_resubmit", "deny_final"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "deny_resubmit" && !notes) {
    return NextResponse.json(
      { error: "A note explaining what to change is required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (!["submitted", "denied_resubmit"].includes(application.status)) {
    return NextResponse.json(
      { error: "This application has already been decided." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    const handleFree = await isHandleAvailable(application.handle, application.id);
    if (!handleFree) {
      return NextResponse.json(
        {
          error:
            "That handle was taken by someone else since this was submitted. Deny and ask the applicant to choose another.",
        },
        { status: 409 }
      );
    }

    const { error: builderError } = await supabase.from("builders").insert({
      user_id: application.user_id,
      handle: application.handle,
      description: application.description,
      socials: application.socials,
    });
    if (builderError) {
      return NextResponse.json({ error: builderError.message }, { status: 500 });
    }

    const { error: userError } = await supabase
      .from("users")
      .update({ role: "builder" })
      .eq("id", application.user_id);
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    const { error: appError } = await supabase
      .from("applications")
      .update({ status: "approved", decided_by: adminId, decided_at: now, admin_notes: notes })
      .eq("id", id);
    if (appError) {
      return NextResponse.json({ error: appError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "deny_resubmit") {
    const { error } = await supabase
      .from("applications")
      .update({
        status: "denied_resubmit",
        admin_notes: notes,
        decided_by: adminId,
        decided_at: now,
        denied_snapshot: {
          handle: application.handle,
          description: application.description,
          socials: application.socials,
          photos: application.photos,
        },
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "denied_resubmit" });
  }

  // deny_final
  const { error } = await supabase
    .from("applications")
    .update({
      status: "denied_final",
      admin_notes: notes,
      decided_by: adminId,
      decided_at: now,
      reapply_after: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "denied_final" });
}
