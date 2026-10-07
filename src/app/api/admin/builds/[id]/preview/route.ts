import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthError } from "@/lib/verifyRequestUser";
import { requireAdmin } from "@/lib/requireAdmin";
import { BuildPhoto, signBuildPhotoUrls } from "@/lib/buildAssets";
import { maskVin } from "@/lib/vin";

/**
 * Everything the Admin preview page needs to render a Build -- in any status,
 * published or not -- through the same template the public page uses.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: build } = await supabase
    .from("builds")
    .select("id, title, status, visibility, slug, year, make, model, trim, vin, theme, photos, draft_content, builder_id")
    .eq("id", id)
    .maybeSingle();
  if (!build) return NextResponse.json({ error: "Build not found." }, { status: 404 });

  const { data: builder } = await supabase
    .from("builders")
    .select("handle")
    .eq("user_id", build.builder_id)
    .maybeSingle();

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
      id: build.id,
      vinMasked: maskVin(build.vin),
      theme: build.theme,
    },
    draft: build.draft_content ?? null,
    photos: urls.map((url, i) => ({ url, caption: entries[i]?.caption, category: entries[i]?.category })),
    handle: builder?.handle ?? null,
  });
}
