import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { isDraftStale } from "@/lib/draftInputs";
import {
  BuildDocument,
  BuildPhoto,
  MAX_BUILD_DOCUMENTS,
  MAX_BUILD_PHOTOS,
  signBuildDocumentUrls,
  signBuildPhotoUrls,
  parseJsonArray,
} from "@/lib/buildAssets";

const THEME_MAX_LENGTH = 400;

/** "1971" -> 1971; anything blank or implausible -> null. */
function parseYear(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 1885 && n <= 2100 ? n : null;
} // generous ceiling for "2 sentences max"

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
    (builds ?? []).map(async ({ access_password_hash: _h, draft_input_hash: _d, ...b }) => ({
      ...b,
      draft_stale: isDraftStale({ ...b, draft_input_hash: _d }),
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

  const year = parseYear(form.get("year"));
  const make = String(form.get("make") ?? "").trim();
  const model = String(form.get("model") ?? "").trim();
  const trim = String(form.get("trim") ?? "").trim();
  const vin = String(form.get("vin") ?? "").trim();
  const theme = String(form.get("theme") ?? "").trim();
  const builderNotes = String(form.get("builderNotes") ?? "").trim() || null;
  // Files are uploaded by the browser straight to storage (see
  // /api/builds/upload-urls); only their paths arrive here. Anything outside
  // this Builder's own folder is refused.
  const newPhotoPaths: string[] = parseJsonArray(form.get("newPhotoPaths")).filter(
    (p): p is string => typeof p === "string" && p.startsWith(`${builderId}/`) && !p.includes("..")
  );
  const newDocEntries: BuildDocument[] = parseJsonArray(form.get("newDocuments"))
    .filter(
      (d): d is { path: string; filename: string } =>
        typeof d?.path === "string" && d.path.startsWith(`${builderId}/`) && !d.path.includes("..")
    )
    .map((d) => ({ path: d.path, filename: String(d.filename ?? "document.pdf").slice(0, 200) }));

  if (newPhotoPaths.length > MAX_BUILD_PHOTOS) {
    return NextResponse.json({ error: `No more than ${MAX_BUILD_PHOTOS} photos allowed.` }, { status: 400 });
  }
  if (newDocEntries.length > MAX_BUILD_DOCUMENTS) {
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
    // A new Build has no AI draft yet by definition: save it, generate the
    // draft, then submit.
    return NextResponse.json({ error: "Save this build and generate your page draft before submitting." }, { status: 400 });
  }

  const documents: BuildDocument[] = newDocEntries;
  const photoPaths = newPhotoPaths;
  const photos: BuildPhoto[] = photoPaths.map((path) => ({ path }));
  const title = [year, make, model, trim].filter(Boolean).join(" ") || "Untitled Build";
  const status = "draft";

  const supabase = getSupabaseAdmin();
  const { data: build, error } = await supabase
    .from("builds")
    .insert({
      builder_id: builderId,
      title,
      year,
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

  const { access_password_hash: _h, draft_input_hash: _d, ...safeBuild } = build;
  return NextResponse.json({
    ok: true,
    build: {
      ...safeBuild,
      photoUrls: await signBuildPhotoUrls(photos),
      documentUrls: await signBuildDocumentUrls(documents),
    },
  });
}
