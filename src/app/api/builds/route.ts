import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import {
  BuildDocument,
  BuildPhoto,
  MAX_BUILD_DOCUMENTS,
  MAX_BUILD_PHOTOS,
  signBuildDocumentUrls,
  signBuildPhotoUrls,
  uploadBuildDocument,
  uploadBuildPhoto,
} from "@/lib/buildAssets";

// Max 5 submitted-and-undecided Build submissions per Builder at once (see
// the comment on builds.status in 0002_phase2.sql) -- enforced here rather
// than as a DB constraint, since it's a count, not a uniqueness rule.
const MAX_UNDECIDED_SUBMISSIONS = 5;
const THEME_MAX_LENGTH = 400; // generous ceiling for "2 sentences max"

/** Builder's own Builds -- every status, newest first. */
export async function GET(req: NextRequest) {
  let builderId: string;
  try {
    ({ builderId } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const { data: builds } = await supabase
    .from("builds")
    .select("*")
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    (builds ?? []).map(async (b) => ({
      ...b,
      photoUrls: await signBuildPhotoUrls((b.photos ?? []) as BuildPhoto[]),
      documentUrls: await signBuildDocumentUrls((b.documents ?? []) as BuildDocument[]),
    }))
  );

  return NextResponse.json({ builds: withUrls });
}

/**
 * Create a new Build submission. `action=save` writes a draft (nothing
 * required yet); `action=submit` requires the full typed field set plus at
 * least one photo, and moves straight to 'submitted'. Mirrors
 * /api/applications's save-or-submit shape, but a Builder can have many
 * Build rows (one per car), not just one active row.
 */
export async function POST(req: NextRequest) {
  let builderId: string;
  try {
    ({ builderId } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const form = await req.formData();
  const action = form.get("action");
  if (action !== "save" && action !== "submit") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const make = String(form.get("make") ?? "").trim();
  const model = String(form.get("model") ?? "").trim();
  const trim = String(form.get("trim") ?? "").trim();
  const vin = String(form.get("vin") ?? "").trim();
  const theme = String(form.get("theme") ?? "").trim();
  const builderNotes = String(form.get("builderNotes") ?? "").trim() || null;
  const newPhotoFiles = form.getAll("newPhotos").filter((f): f is File => f instanceof File);
  const newDocFiles = form.getAll("newDocuments").filter((f): f is File => f instanceof File);

  if (newPhotoFiles.length > MAX_BUILD_PHOTOS) {
    return NextResponse.json({ error: `No more than ${MAX_BUILD_PHOTOS} photos allowed.` }, { status: 400 });
  }
  if (newDocFiles.length > MAX_BUILD_DOCUMENTS) {
    return NextResponse.json(
      { error: `No more than ${MAX_BUILD_DOCUMENTS} documents allowed.` },
      { status: 400 }
    );
  }
  if (theme.length > THEME_MAX_LENGTH) {
    return NextResponse.json(
      { error: "Theme is too long -- keep it to two sentences." },
      { status: 400 }
    );
  }

  if (action === "submit") {
    const missing = [
      !make && "Make",
      !model && "Model",
      !trim && "Trim",
      !vin && "VIN",
      !theme && "Theme",
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json({ error: `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required.` }, { status: 400 });
    }
    if (newPhotoFiles.length < 1) {
      return NextResponse.json({ error: "At least one photo is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("builds")
      .select("id", { count: "exact", head: true })
      .eq("builder_id", builderId)
      .eq("status", "submitted");
    if ((count ?? 0) >= MAX_UNDECIDED_SUBMISSIONS) {
      return NextResponse.json(
        {
          error: `You already have ${MAX_UNDECIDED_SUBMISSIONS} submissions awaiting review. Please wait for a decision before submitting another.`,
        },
        { status: 409 }
      );
    }
  }

  let photoPaths: string[] = [];
  let documents: BuildDocument[] = [];
  try {
    photoPaths = await Promise.all(newPhotoFiles.map((f) => uploadBuildPhoto(builderId, f)));
    documents = await Promise.all(newDocFiles.map((f) => uploadBuildDocument(builderId, f)));
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const photos: BuildPhoto[] = photoPaths.map((path) => ({ path }));
  const title = [make, model, trim].filter(Boolean).join(" ") || "Untitled Build";
  const status = action === "submit" ? "submitted" : "draft";

  const supabase = getSupabaseAdmin();
  const { data: build, error } = await supabase
    .from("builds")
    .insert({
      builder_id: builderId,
      title,
      make: make || null,
      model: model || null,
      trim: trim || null,
      vin: vin || null,
      theme: theme || null,
      builder_notes: builderNotes,
      photos,
      documents,
      status,
    })
    .select("*")
    .single();

  if (error || !build) {
    return NextResponse.json({ error: error?.message ?? "Could not save the build." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    build: {
      ...build,
      photoUrls: await signBuildPhotoUrls(photos),
      documentUrls: await signBuildDocumentUrls(documents),
    },
  });
}
