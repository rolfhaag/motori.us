import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import {
  BuildDocument,
  BuildPhoto,
  MAX_BUILD_DOCUMENTS,
  MAX_BUILD_PHOTOS,
  deleteBuildDocuments,
  deleteBuildPhotos,
  signBuildDocumentUrls,
  signBuildPhotoUrls,
  uploadBuildDocument,
  uploadBuildPhoto,
} from "@/lib/buildAssets";

const MAX_UNDECIDED_SUBMISSIONS = 5;
const THEME_MAX_LENGTH = 400;
// Only a Build the Builder is still actively working can be edited --
// under-review ('submitted'), live ('published'), and terminally 'denied'
// Builds are frozen here. 'changes_requested' ("needs response" on the
// Builder dashboard) is Admin sending it back for a revision and resubmit.
const EDITABLE_STATUSES = ["draft", "changes_requested"];

/**
 * Save-or-submit an edit to an existing Build the caller owns. Mirrors
 * /api/builds's create path, but diffs existing photos/documents against
 * what's kept, same pattern as /api/applications.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let builderId: string;
  try {
    ({ builderId } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase.from("builds").select("*").eq("id", id).maybeSingle();
  if (!existing || existing.builder_id !== builderId) {
    return NextResponse.json({ error: "Build not found." }, { status: 404 });
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: "This build can't be edited while it's under review or published." },
      { status: 409 }
    );
  }

  if (existing.draft_status === "running") {
    return NextResponse.json(
      { error: "Your draft is being generated -- please wait until it finishes." },
      { status: 409 }
    );
  }

  const form = await req.formData();
  const action = form.get("action");
  if (action !== "save" && action !== "submit") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "submit" && !existing.draft_content) {
    return NextResponse.json({ error: "Generate your page draft before submitting." }, { status: 400 });
  }

  const yearRaw = String(form.get("year") ?? "").trim();
  const yearNum = Number(yearRaw);
  const year = Number.isInteger(yearNum) && yearNum >= 1885 && yearNum <= 2100 ? yearNum : null;
  const make = String(form.get("make") ?? "").trim();
  const model = String(form.get("model") ?? "").trim();
  const trim = String(form.get("trim") ?? "").trim();
  const vin = String(form.get("vin") ?? "").trim();
  const theme = String(form.get("theme") ?? "").trim();
  const builderNotes = String(form.get("builderNotes") ?? "").trim() || null;

  const keepPhotoPaths = JSON.parse(String(form.get("existingPhotos") ?? "[]")) as string[];
  const keepDocPaths = JSON.parse(String(form.get("existingDocuments") ?? "[]")) as string[];
  const newPhotoFiles = form.getAll("newPhotos").filter((f): f is File => f instanceof File);
  const newDocFiles = form.getAll("newDocuments").filter((f): f is File => f instanceof File);

  const existingPhotos = (existing.photos ?? []) as BuildPhoto[];
  const existingDocs = (existing.documents ?? []) as BuildDocument[];
  // Keep the Builder's order (first photo = hero), not the stored order.
  const keptPhotos = keepPhotoPaths
    .map((path) => existingPhotos.find((p) => p.path === path))
    .filter((p): p is BuildPhoto => Boolean(p));
  const keptDocs = existingDocs.filter((d) => keepDocPaths.includes(d.path));
  const photosToDelete = existingPhotos.filter((p) => !keepPhotoPaths.includes(p.path)).map((p) => p.path);
  const docsToDelete = existingDocs.filter((d) => !keepDocPaths.includes(d.path)).map((d) => d.path);

  if (keptPhotos.length + newPhotoFiles.length > MAX_BUILD_PHOTOS) {
    return NextResponse.json({ error: `No more than ${MAX_BUILD_PHOTOS} photos allowed.` }, { status: 400 });
  }
  if (keptDocs.length + newDocFiles.length > MAX_BUILD_DOCUMENTS) {
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
      !year && "Year",
      !make && "Make",
      !model && "Model",
      !trim && "Trim",
      !vin && "VIN",
      !theme && "Theme",
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required.` },
        { status: 400 }
      );
    }
    if (keptPhotos.length + newPhotoFiles.length < 1) {
      return NextResponse.json({ error: "At least one photo is required." }, { status: 400 });
    }
    const { count } = await supabase
      .from("builds")
      .select("id", { count: "exact", head: true })
      .eq("builder_id", builderId)
      .eq("status", "submitted")
      .neq("id", id);
    if ((count ?? 0) >= MAX_UNDECIDED_SUBMISSIONS) {
      return NextResponse.json(
        {
          error: `You already have ${MAX_UNDECIDED_SUBMISSIONS} submissions awaiting review. Please wait for a decision before submitting another.`,
        },
        { status: 409 }
      );
    }
  }

  let newPhotoPaths: string[] = [];
  let newDocs: BuildDocument[] = [];
  try {
    newPhotoPaths = await Promise.all(newPhotoFiles.map((f) => uploadBuildPhoto(builderId, f)));
    newDocs = await Promise.all(newDocFiles.map((f) => uploadBuildDocument(builderId, f)));
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const finalPhotos: BuildPhoto[] = [...keptPhotos, ...newPhotoPaths.map((path) => ({ path }))];
  const finalDocs: BuildDocument[] = [...keptDocs, ...newDocs];
  const title = [year, make, model, trim].filter(Boolean).join(" ") || existing.title;
  const status =
    action === "submit" ? "submitted" : existing.status === "changes_requested" ? "draft" : existing.status;

  const { error } = await supabase
    .from("builds")
    .update({
      title,
      year,
      make: make || null,
      model: model || null,
      trim: trim || null,
      vin: vin || null,
      theme: theme || null,
      builder_notes: builderNotes,
      photos: finalPhotos,
      documents: finalDocs,
      status,
      admin_notes: action === "submit" ? null : existing.admin_notes,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (photosToDelete.length > 0) await deleteBuildPhotos(photosToDelete).catch(() => {});
  if (docsToDelete.length > 0) await deleteBuildDocuments(docsToDelete).catch(() => {});

  return NextResponse.json({
    ok: true,
    status,
    photoUrls: await signBuildPhotoUrls(finalPhotos),
    documentUrls: await signBuildDocumentUrls(finalDocs),
  });
}

/** Cancel a Build the caller owns -- only while it's still a draft. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let builderId: string;
  try {
    ({ builderId } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("builds")
    .select("id, builder_id, status, photos, documents")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.builder_id !== builderId) {
    return NextResponse.json({ error: "Build not found." }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only a draft build can be cancelled." }, { status: 409 });
  }

  const { error } = await supabase.from("builds").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await deleteBuildPhotos(((existing.photos ?? []) as BuildPhoto[]).map((p) => p.path)).catch(() => {});
  await deleteBuildDocuments(((existing.documents ?? []) as BuildDocument[]).map((d) => d.path)).catch(
    () => {}
  );

  return NextResponse.json({ ok: true });
}
