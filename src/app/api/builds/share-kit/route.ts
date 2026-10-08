import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { SITE_URL } from "@/lib/siteUrl";
import { E9_SHARE_PHOTOS, E9_SLUG, pickShareIndexes, buildCaption } from "@/lib/shareKit";
import type { DraftContent } from "@/lib/buildDraft";

/**
 * Share-kit details for the signed-in Builder's own published, public Build:
 * how many images are available and a ready-made caption. Anyone else (or
 * a not-yet-public build) gets a 404 and the page just shows the normal
 * share dialog.
 */
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

  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const { data: build } = await getSupabaseAdmin()
    .from("builds")
    .select("builder_id, title, make, model, theme, photos, draft_content")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("hidden", false)
    .maybeSingle();
  if (!build || build.builder_id !== builderId) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const photoCount = Array.isArray(build.photos) && build.photos.length > 0
    ? pickShareIndexes(build.photos).length
    : slug === E9_SLUG
    ? E9_SHARE_PHOTOS.length
    : 0;
  const url = `${SITE_URL}/builds/${slug}/`;
  const thesis = (build.draft_content as DraftContent | null)?.hero?.thesis || build.theme || null;

  return NextResponse.json({
    url,
    imageCount: photoCount,
    caption: buildCaption({ title: build.title, thesis, url, make: build.make, model: build.model }),
  });
}
