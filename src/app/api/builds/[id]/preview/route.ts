import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireBuilder } from "@/lib/requireBuilder";
import { BuildPhoto, signBuildPhotoUrls } from "@/lib/buildAssets";

/** The signed-in Builder's own Build, shaped for the preview page. Owner only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let builderId: string;
  let handle: string;
  try {
    ({ builderId, handle } = await requireBuilder(req));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const { data: build } = await getSupabaseAdmin()
    .from("builds")
    .select("id, title, status, visibility, slug, year, make, model, trim, vin, theme, photos, draft_content, builder_id")
    .eq("id", id)
    .maybeSingle();
  if (!build || build.builder_id !== builderId) {
    return NextResponse.json({ error: "Build not found." }, { status: 404 });
  }

  const entries = (build.photos ?? []) as BuildPhoto[];
  const urls = await signBuildPhotoUrls(entries);
  return NextResponse.json({
    build: {
      title: build.title,
      status: build.status,
      visibility: build.visibility,
      slug: build.slug ?? "preview",
      year: build.year,
      make: build.make,
      model: build.model,
      trim: build.trim,
      vin: build.vin,
      theme: build.theme,
    },
    draft: build.draft_content ?? null,
    photos: urls.map((url, i) => ({ url, caption: entries[i]?.caption, category: entries[i]?.category })),
    handle,
  });
}
