import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { BUILD_PHOTOS_BUCKET, ensureBuildPhotosBucket, BuildPhoto } from "@/lib/buildAssets";
import { generateAccessPassword, hashAccessPassword } from "@/lib/buildAccess";
import { SITE_URL } from "@/lib/siteUrl";
import { E9_DRAFT, E9_PHOTOS } from "@/lib/e9Content";

export const maxDuration = 120;

const E9_SLUG = "71e9S38B36";
const COPY_SLUG = "e9-dynamic-preview";

/**
 * Admin-only, one-off: builds (or refreshes) a PRIVATE dynamic copy of the
 * original E9 page from its legacy content, so the two can be compared side
 * by side. The live /builds/71e9S38B36 page is never touched. Photos are
 * fetched from the live site's static images and stored in the private
 * build-photos bucket; the copy borrows year/make/model/trim/theme/VIN and
 * the owning Builder from the existing E9 row.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const { data: src } = await supabase
    .from("builds")
    .select("builder_id, title, year, make, model, trim, vin, theme")
    .eq("slug", E9_SLUG)
    .maybeSingle();
  if (!src) {
    return NextResponse.json({ error: "The original E9 build row wasn't found." }, { status: 404 });
  }

  try {
    await ensureBuildPhotosBucket();
    const photos: BuildPhoto[] = [];
    for (const p of E9_PHOTOS) {
      const res = await fetch(`${SITE_URL}/images/${p.file}`);
      if (!res.ok) throw new Error(`Couldn't fetch ${p.file} (${res.status}).`);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = `${src.builder_id}/e9-copy/${p.file}`;
      const { error } = await supabase.storage
        .from(BUILD_PHOTOS_BUCKET)
        .upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      photos.push({ path, caption: p.caption, category: p.category });
    }

    const { data: existing } = await supabase.from("builds").select("id").eq("slug", COPY_SLUG).maybeSingle();
    const password = generateAccessPassword();
    const fields = {
      builder_id: src.builder_id,
      slug: COPY_SLUG,
      title: src.title,
      year: src.year,
      make: src.make,
      model: src.model,
      trim: src.trim,
      vin: src.vin,
      theme: src.theme,
      photos,
      draft_content: E9_DRAFT,
      draft_status: "done",
      status: "published",
      visibility: "private",
      hidden: false,
      access_password_hash: hashAccessPassword(password),
    };
    const { error } = existing
      ? await supabase.from("builds").update(fields).eq("id", existing.id)
      : await supabase.from("builds").insert(fields);
    if (error) throw error;

    return NextResponse.json({
      url: `${SITE_URL}/builds/${COPY_SLUG}/`,
      password,
      photos: photos.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
