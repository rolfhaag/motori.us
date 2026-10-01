import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError, verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  deleteApplicationPhotos,
  signApplicationPhotoUrls,
  uploadApplicationPhoto,
} from "@/lib/applicationPhotos";
import { isHandleAvailable, isValidHandleFormat, normalizeHandle } from "@/lib/builderHandle";

const ACTIVE_STATUSES = ["draft", "submitted", "denied_resubmit"];
const MAX_PHOTOS = 3;

function snapshotsEqual(
  a: { handle: string; description: string; socials: string | null; photos: string[] },
  b: { handle: string; description: string; socials: string | null; photos: string[] } | null
) {
  if (!b) return false;
  return (
    a.handle === b.handle &&
    a.description === b.description &&
    (a.socials ?? "") === (b.socials ?? "") &&
    JSON.stringify([...a.photos].sort()) === JSON.stringify([...b.photos].sort())
  );
}

/**
 * Save-or-submit an application in one call. `action=save` writes a draft
 * (most fields optional); `action=submit` requires the full set and moves
 * the row to 'submitted' for Admin review. Handles both creating the first
 * row and editing an existing draft/denied_resubmit row -- there's only
 * ever one active row per user (enforced by the partial unique index).
 */
export async function POST(req: NextRequest) {
  let privyUserId: string;
  try {
    ({ privyUserId } = await verifyRequestUser(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  const form = await req.formData();
  const action = form.get("action");
  if (action !== "save" && action !== "submit") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const handle = normalizeHandle(String(form.get("handle") ?? ""));
  const description = String(form.get("description") ?? "").trim();
  const socials = String(form.get("socials") ?? "").trim() || null;
  const keepPhotos = JSON.parse(String(form.get("existingPhotos") ?? "[]")) as string[];
  const newPhotoFiles = form.getAll("newPhotos").filter((f): f is File => f instanceof File);

  if (!handle) {
    return NextResponse.json({ error: "A desired Builder handle is required." }, { status: 400 });
  }
  if (!isValidHandleFormat(handle)) {
    return NextResponse.json(
      { error: "Handle must be 3-30 characters: lowercase letters, numbers, and hyphens only." },
      { status: 400 }
    );
  }

  // Find this user's current active (non-terminal) application, if any.
  const { data: existing } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", privyUserId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  if (!existing) {
    // No active application -- check they're actually allowed to start one.
    const { data: builder } = await supabase
      .from("builders")
      .select("user_id")
      .eq("user_id", privyUserId)
      .maybeSingle();
    if (builder) {
      return NextResponse.json(
        { error: "You're already a Builder -- no need to apply again." },
        { status: 409 }
      );
    }
    const { data: lastTerminal } = await supabase
      .from("applications")
      .select("status, reapply_after")
      .eq("user_id", privyUserId)
      .eq("status", "denied_final")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastTerminal?.reapply_after && new Date(lastTerminal.reapply_after) > new Date()) {
      return NextResponse.json(
        {
          error: `You can reapply after ${new Date(lastTerminal.reapply_after).toLocaleDateString()}.`,
        },
        { status: 403 }
      );
    }
  }

  const handleFree = await isHandleAvailable(handle, existing?.id);
  if (!handleFree) {
    return NextResponse.json(
      { error: "That handle is already taken. Please choose another." },
      { status: 409 }
    );
  }

  const existingPhotoSet = new Set<string>(existing?.photos ?? []);
  const toDelete = [...existingPhotoSet].filter((p) => !keepPhotos.includes(p));

  if (newPhotoFiles.length + keepPhotos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `No more than ${MAX_PHOTOS} photos allowed.` },
      { status: 400 }
    );
  }

  if (action === "submit") {
    if (!description) {
      return NextResponse.json({ error: "A short builder description is required." }, { status: 400 });
    }
    if (keepPhotos.length + newPhotoFiles.length < 1) {
      return NextResponse.json(
        { error: "At least one photo of a potential build is required." },
        { status: 400 }
      );
    }
    if (existing?.status === "denied_resubmit") {
      const candidate = { handle, description, socials, photos: [...keepPhotos] };
      // newPhotoFiles aren't in the comparison set yet, but any new upload
      // alone already counts as a change, so only block when nothing at all
      // changed and no new photos were added.
      if (newPhotoFiles.length === 0 && snapshotsEqual(candidate, existing.denied_snapshot)) {
        return NextResponse.json(
          { error: "Please make at least one change before resubmitting." },
          { status: 400 }
        );
      }
    }
  }

  let newPaths: string[] = [];
  try {
    newPaths = await Promise.all(
      newPhotoFiles.map((file) => uploadApplicationPhoto(privyUserId, file))
    );
  } catch {
    return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
  }

  const finalPhotos = [...keepPhotos, ...newPaths];
  // Saving (not submitting) never changes status -- a denied_resubmit row
  // stays denied_resubmit while they work on it, it just isn't resubmitted
  // yet. Only a brand-new row defaults to 'draft'.
  const status = action === "submit" ? "submitted" : existing?.status ?? "draft";

  const payload = {
    user_id: privyUserId,
    handle,
    description,
    socials,
    photos: finalPhotos,
    status,
  };

  let saveError;
  if (existing) {
    ({ error: saveError } = await supabase.from("applications").update(payload).eq("id", existing.id));
  } else {
    ({ error: saveError } = await supabase.from("applications").insert(payload));
  }

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  if (toDelete.length > 0) {
    await deleteApplicationPhotos(toDelete).catch(() => {});
  }

  const photoUrls = await signApplicationPhotoUrls(finalPhotos);
  return NextResponse.json({ ok: true, status, photoUrls, photos: finalPhotos });
}
