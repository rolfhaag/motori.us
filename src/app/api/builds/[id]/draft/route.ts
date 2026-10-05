import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { DRAFT_STALE_MS, MAX_DRAFT_RUNS, MAX_FEEDBACK_LENGTH, runBuildDraft } from "@/lib/buildDraft";

// Drafting runs after the response is sent; give it room.
export const maxDuration = 300;

const EDITABLE_STATUSES = ["draft", "changes_requested"];

async function loadOwned(req: NextRequest, id: string) {
  const { builderId } = await requireBuilder(req);
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("builds").select("*").eq("id", id).maybeSingle();
  if (!data || data.builder_id !== builderId) return null;

  // A run that never reported back (function killed mid-draft) shouldn't
  // leave the Builder stuck on "running" forever.
  if (
    data.draft_status === "running" &&
    data.draft_started_at &&
    Date.now() - new Date(data.draft_started_at).getTime() > DRAFT_STALE_MS
  ) {
    await supabase
      .from("builds")
      .update({ draft_status: "failed", draft_error: "Drafting timed out. Please try again." })
      .eq("id", id);
    data.draft_status = "failed";
    data.draft_error = "Drafting timed out. Please try again.";
  }
  return data;
}

function authFailure(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}

/** Polled by the Build form while a draft is running. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let build;
  try {
    build = await loadOwned(req, id);
  } catch (err) {
    return authFailure(err);
  }
  if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });
  return NextResponse.json({
    draft_status: build.draft_status,
    draft_error: build.draft_error,
    draft_runs: build.draft_runs,
    has_draft: Boolean(build.draft_content),
  });
}

/** Starts a first draft ("Generate Draft") or a refresh ("Update Draft"). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let build;
  try {
    build = await loadOwned(req, id);
  } catch (err) {
    return authFailure(err);
  }
  if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });

  if (!EDITABLE_STATUSES.includes(build.status)) {
    return NextResponse.json({ error: "This build can't be edited right now." }, { status: 409 });
  }
  if (build.draft_status === "running") {
    return NextResponse.json({ error: "A draft is already being generated." }, { status: 409 });
  }
  if (build.draft_runs >= MAX_DRAFT_RUNS) {
    return NextResponse.json(
      { error: "You've used all of your draft updates for this build." },
      { status: 409 }
    );
  }
  if (!build.make || !build.model || !build.trim || !build.theme) {
    return NextResponse.json(
      { error: "Make, Model, Trim and Theme are required before generating a draft." },
      { status: 400 }
    );
  }
  if (!Array.isArray(build.photos) || build.photos.length < 1) {
    return NextResponse.json({ error: "Upload at least one photo first." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, MAX_FEEDBACK_LENGTH) : "";

  const { error } = await getSupabaseAdmin()
    .from("builds")
    .update({
      draft_status: "running",
      draft_error: null,
      draft_started_at: new Date().toISOString(),
      draft_feedback: build.draft_content ? feedback || null : null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(() => runBuildDraft(id));

  return NextResponse.json({ ok: true, draft_status: "running" });
}
